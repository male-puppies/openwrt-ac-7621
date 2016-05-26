#define _GNU_SOURCE
#include <sched.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <inttypes.h>
#include <fcntl.h>
#include <errno.h>

#include <sys/wait.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/mman.h>
#include <sys/socket.h>

#include <linux/netlink.h>

#include <pthread.h>

#include <ntrack_rbf.h>
#include <ntrack_log.h>
#include <ntrack_msg.h>
#include <ntrack_auth.h>

/* update conf to kernel modules */
extern int nt_nl_init(void);
extern int nt_nl_xmit(void *data);

/* kernel user node message delivery to authd. */
extern int nt_unotify_init(void);
extern int nt_unotify(void *buff, int len);

static ntrack_t ntrack;

static int fn_message_disp(void *p)
{
#if 0
	cpu_set_t set;
	CPU_ZERO(&set);
	if(sched_getaffinity(0, sizeof(set), &set) == -1) {
		nt_error("get affinity.\n");
		return 0;
	}
	int i;
	for(i=0; i<CPU_COUNT(&set); i++) {
		if(CPU_ISSET(i, &set)) {
			nt_info("running on core: %d\n", i);
		}
	}
#endif

	nmsg_hdr_t *hdr = p;
	switch(hdr->type) {
		case en_MSG_t_PCAP:
		break;
		case en_MSG_t_NODE:
		break;
		case en_MSG_t_AUTH:
		{
			user_info_t *ui;
			auth_msg_t *auth = nmsg_data(hdr);
			
			nt_info("message uid: %u, magic: %u\n", auth->id, auth->magic);

			ui = nt_get_user_by_id(&ntrack, auth->id, auth->magic);
			if(ui) {
				dump_user(ui);
				nt_unotify((void*)auth, sizeof(auth_msg_t));
			}else{
				nt_error("[%u:%u]->not found userinfo.\n", auth->id, auth->magic);
			}
		}
		break;
		default:
		{
			nt_error("unknown message. %d\n", hdr->type);
		}
		break;
	}
	return 0;
}

char *auth_conf = " \
	{ \
		\"Type\": \"AuthRules\", \
		\"Rules\": [{\
			\"Name\": \"Web\", \
			\"IPSets\": [\"WebAuth\", \"Default\"], \
			\"Flags\": 1 \
		}, \
		{ \
			\"Name\": \"Auto\", \
			\"IPSets\": [\"AutoAuth\"], \
			\"Flags\": 0 \
		}] \
	}";

char *weix_conf = " \
	{ \
		\"Type\": \"WeiXin\", \
		[] \
	}";

typedef struct {
	int running;
	pthread_t tid;
} nt_thread_t;

void *nt_work_fn(void *d)
{
	rbf_t *rbfp;
	cpu_set_t set;
	nt_thread_t *nth = (nt_thread_t*)d;

	CPU_ZERO(&set);
	CPU_SET(nth->running - 1, &set);
	if(sched_setaffinity(0, sizeof(set), &set) == -1) {
		nt_error("set [%d] affinity.\n", nth->running);
		return -1;
	}

	nt_info("nt work thread on core: %d\n", nth->running - 1);
	if(nt_message_init(&rbfp)){
		nt_error("ring buff init failed.\n");
		return -1;
	}

	nt_message_process(rbfp, &nth->running, fn_message_disp);
	return 0;
}

int main(int argc, char *argv[])
{
	int i;

	/* to kernel */
	nt_nl_init();
	/* to user authd. */
	nt_unotify_init();

	/* test update conf. */
	nt_nl_xmit(auth_conf);

	/* message crc buffer & user/flow info. */
	if (nt_base_init(&ntrack)) {
		nt_error("ntrack message init failed.\n");
		return 0;
	}

	cpu_set_t set;
	CPU_ZERO(&set);
	if (sched_getaffinity(0, sizeof(set), &set) == -1) {
		nt_error("get cpuset error: %s\n", strerror(errno));
		exit(EXIT_FAILURE);
	}

	nt_info("core total nums[%d]\n", CPU_COUNT(&set));
	nt_thread_t *threads = malloc(sizeof(nt_thread_t) * CPU_COUNT(&set));
	for (i=0; i<CPU_COUNT(&set); i++) {
		pthread_attr_t attr;
		pthread_attr_init(&attr);

		threads[i].running = i + 1;
		if(pthread_create(&threads[i].tid, &attr, nt_work_fn, &threads[i]) !=0 ) {
			nt_error("create [%d] work thread.\n", i);
			exit(EXIT_FAILURE);
		}
		usleep(100);
	}

	for(i=0; i<CPU_COUNT(&set); i++) {
		void *res;
		if(pthread_join(threads[i].tid, &res) !=0 ) {
			nt_error("join thread[%d] error.\n", i);
			exit(EXIT_FAILURE);
		}
		nt_info("join %d: %p\n", i, res);
		free(res);
	}
	free(threads);
	return 0;
}

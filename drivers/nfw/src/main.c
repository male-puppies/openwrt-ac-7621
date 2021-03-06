#include <linux/module.h>
#include <linux/netfilter.h>
#include <linux/ip.h>
#include <linux/version.h>

#include <net/ip.h>
#include <net/netfilter/nf_conntrack.h>
#include <ntrack_packet.h>

#define __DEBUG 1

#include "nfw_private.h"

#define DRV_VERSION	"0.1.1"
#define DRV_DESC	"ntrack layer 7 firewall system driver"

#if (LINUX_VERSION_CODE > KERNEL_VERSION(3,18,20))
static unsigned int nfw_hook_fn(void *priv,
		struct sk_buff *skb,
		const struct nf_hook_state *state)
#else
static unsigned int nfw_hook_fn(const struct nf_hook_ops *ops,
		struct sk_buff *skb,
		const struct net_device *in,
		const struct net_device *out,
		int (*okfn)(struct sk_buff *))
#endif
{
#if (LINUX_VERSION_CODE > KERNEL_VERSION(3,18,20))
	 //struct net_device *in = state->in, *out = state->out;
#endif

	int ret = NF_ACCEPT;
	struct nf_conn *ct;
	flow_info_t *fi;
	user_info_t *ui, *pi;
	// struct iphdr *iph;
	// struct sk_buff *linear_skb = NULL, *use_skb = NULL;
	enum ip_conntrack_info ctinfo;
	struct nos_track* nos;

	ct = nf_ct_get(skb, &ctinfo);
	if (!ct) {
		return NF_ACCEPT;
	}

	if(nf_ct_is_untracked(ct)) {
		return NF_ACCEPT;
	}

	if((nos = nf_ct_get_nos(ct)) == NULL) {
		fw_debug("nos untracked.\n");
		return NF_ACCEPT;
	}

	fi = nt_flow(nos);
	ui = nt_user(nos);
	pi = nt_peer(nos);
	if(!fi || !ui || !pi) {
		return NF_ACCEPT;
	}

	if (nt_flow_accepted(fi)) {
		fw_debug(FMT_FLOW_STR "accepted\n", FMT_FLOW(fi));
		return NF_ACCEPT;
	}

	/* lookup flow drop flags here */
	ret = nt_flow_droped(fi);
	if(ret != 0) {
		/* TODO: log to userspace this acction. */
		ret = nfw_droplist_match(fi);
		if(ret == 0){
			fw_debug(FMT_FLOW_STR " droplist not care.\n", FMT_FLOW(fi));
			return NF_DROP;
		}
		/* TODO: LOG & DROP */
		if(ret > 0) {
			fw_debug(FMT_FLOW_STR " log & bypass %d.\n", FMT_FLOW(fi), ret);
			/* BYPASS */
			if(!nt_flow_dbg_rlmt(fi)) {
				fw_log(FMT_FLOW_STR " bypass\n", FMT_FLOW(fi));
				nt_flow_dbg_rlmt_set(fi);
			}
			return NF_ACCEPT;
		} else {
			fw_debug(FMT_FLOW_STR " log & droped %d.\n", FMT_FLOW(fi), ret);
			/* DROP */
			fw_log(FMT_FLOW_STR " drop\n", FMT_FLOW(fi));
			return NF_DROP;
		}
	}

	return NF_ACCEPT;
}

static struct nf_hook_ops ntrack_nf_hook_ops[] = {
	{
#if (LINUX_VERSION_CODE > KERNEL_VERSION(3,18,20))
		.priv = NULL,
#else
		.owner = THIS_MODULE,
#endif
		.hook = nfw_hook_fn,
		.pf = NFPROTO_IPV4,
		.hooknum = NF_INET_FORWARD,
		.priority = NF_IP_PRI_LAST,
	}
};

void *nfw_klog_fd = NULL;
static int __init nfw_modules_init(void)
{
	int ret = 0;

	nfw_klog_fd = klog_init("nfw", 0x0e, 0);
	if(!nfw_klog_fd) {
		return -ENOMEM;
	}

	ret = nfw_dbg_init();
	if(ret) {
		goto __err;
	}

	fw_info("init nf hooks.\n");
	ret = nf_register_hooks(ntrack_nf_hook_ops, ARRAY_SIZE(ntrack_nf_hook_ops));
	if (ret) {
		goto __err;
	}

	return 0;

__err:
	nfw_dbg_exit();
	if(nfw_klog_fd) {
		klog_fini(nfw_klog_fd);
	}
	return ret;
}

static void __exit nfw_modules_exit(void)
{
	fw_info("module cleanup.\n");

	nfw_dbg_exit();
	nf_unregister_hooks(ntrack_nf_hook_ops, ARRAY_SIZE(ntrack_nf_hook_ops));

	klog_fini(nfw_klog_fd);
	synchronize_rcu();
	return;
}

module_init(nfw_modules_init);
module_exit(nfw_modules_exit);

MODULE_DESCRIPTION(DRV_DESC);
MODULE_VERSION(DRV_VERSION);
MODULE_AUTHOR("ppp <RRR@gmail.com>");
MODULE_LICENSE("GPL");
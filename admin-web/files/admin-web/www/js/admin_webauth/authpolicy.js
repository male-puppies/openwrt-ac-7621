var oTabAuth,
	modify_flag = "add",
	nodeEdit = [];

$(function() {
	oTabAuth = createDtAuth();
	createInitModal();
	verifyEventsInit();
	initEvents();
	initData2();
});

function createDtAuth() {
	var cgiobj = {
		"page": 1,
		"count": 10000
	}
	return $("#table_authpolicy").dataTable({
		"pagingType": "full_numbers",
		"ordering": false,
		"language": {"url": '../../js/lib/dataTables.chinese.json'},
		"ajax": {
			"url": cgiDtUrl("authrule_get", cgiobj),
			"type": "GET",
			"dataSrc": dtDataCallback
		},
		"columns": [
			{
				"data": null,
				"width": 60
			},
			{
				"data": "rulename"
			},
			{
				"data": "ruledesc",
				"render": function (d, t, f) {
					if (d.length == 0) {
						return "--";
					} else {
						return d;
					}
				}
			},
            {
				"data": "ipgrpname",
			  	"render": function (d, t, f) {
					if (d.length == 0) {
						return "--";
					} else {
						return d;
					}
           		}
            },
            {
				"data": "authtype",
            	"render": function (d, t, f) {
					if (d == "web") {
						return 'web认证';
					} else if (d == "wechat") {
						return '微信认证';
					} else if (d == "sms") {
						return '短信认证';
					} else {
						return '自动认证';
					}
               	}
			},
            {
				"data": "rid",
				"render": function(d, t, f) {
					return '<div class="btn-group btn-group-xs"><a class="btn btn-success mark1" onclick="rowMove(\'up\', \'' + d + '\')"><i class="icon-chevron-up"></i></a><a class="btn btn-success mark2" onclick="rowMove(\'down\', \'' + d + '\')"><i class="icon-chevron-down"></i></a></div>';
				}
			},
			{
				"data": "enable",
				"render": function(d, t, f) {
					if (typeof d != "undefined" && d.toString() != "1") {
						return '<a class="btn btn-danger btn-xs" onclick="set_enable(this)" data-toggle="tooltip" data-container="body" title="点击启用"><i class="icon-remove"></i> 已禁用 </a>';
					} else {
						return '<a class="btn btn-success btn-xs" onclick="set_enable(this)" data-toggle="tooltip" data-container="body" title="点击禁用"><i class="icon-ok"></i> 已启用 </a>';
					}
				}
			},
			{
				"data": "rid",
				"width": 100,
				"orderable": false,
				"render": function(d, t, f) {
					return '<div class="btn-group btn-group-xs"><a class="btn btn-zx" onclick="edit(this)" data-toggle="tooltip" data-container="body" title="编辑"><i class="icon-pencil"></i></a><a class="btn btn-danger" onclick="OnDelete(this)" data-toggle="tooltip" data-container="body" title="删除"><i class="icon-trash"></i></a></div>';
				}
			},
			{
				"data": null,
				"width": 60,
				"orderable": false,
				"searchable": false,
				"defaultContent": '<input type="checkbox" value="1 0" />'
			}
        ],
		"rowCallback": function(nTd, sData, oData, iRow, iCol) {
			dtBindRowSelectEvents(nTd);
			$(nTd).find("td:first").html(iRow + 1);
		},
		"drawCallback": function() {
			var rows = this.api().rows().nodes();
			if (rows.length > 0) {
				var firstRow = rows[0];
				var pre_lastRow = this.api().row(rows.length - 1).node();
				$(firstRow).find(".btn-group .mark1").addClass("disabled");
				$(pre_lastRow).find(".btn-group .mark2").addClass("disabled");
			}

			$("body > div.tooltip").remove();
			$('[data-toggle="tooltip"]').tooltip();
		}
	});
}

function createInitModal() {
	$("#modal_edit, #modal_tips").modal({
		"backdrop": "static",
		"show": false
	});
}

function initData2() {
	var args = '["auth_no_flow_timeout","auth_redirect_ip","auth_bypass_dst","auth_offline_time"]';
	var obj = {keys: encodeURI(args)};
	cgicall.get("kv_get", obj, function(d) {
		if (d.status == 0 && typeof d.data != "undefined") {
			var data = d.data;
			if (data.auth_no_flow_timeout.enable == 1) {
				$("input:radio[name=offline].no_flow").prop("checked", true);
				$("#auth_no_flow_timeout").prop("disabled", false);
				$("#auth_offline_time").prop("disabled", true);
			} else {
				$("input:radio[name=offline].offline").prop("checked", true);
				$("#auth_no_flow_timeout").prop("disabled", true);
				$("#auth_offline_time").prop("disabled", false);
			}

			data.auth_bypass_dst = data.auth_bypass_dst.length == 0 ? "" : data.auth_bypass_dst.join("\n");

			var no_flow = data.auth_no_flow_timeout && data.auth_no_flow_timeout.time != "" ? parseInt(data.auth_no_flow_timeout.time) : 3600;
			var flowobj = unitTime(no_flow);
			setUnitTime(flowobj, ".unit-no-flow");
			data.auth_no_flow_timeout = flowobj.time;

			var offline = data.auth_offline_time && data.auth_offline_time.time != "" ? parseInt(data.auth_offline_time.time) : 3600;
			var offobj = unitTime(offline);
			setUnitTime(offobj, ".unit-offline");
			data.auth_offline_time = offobj.time;

			jsonTraversal(d.data, jsTravSet);
		}
	});
}

function initData() {
	dtReloadData(oTabAuth, false)
}

function setUnitTime(obj, id) {
	if (obj.unit == "m") {
		$(id).attr("value", "m").html('分钟<span class="caret"></span>');
	} else if (obj.unit == "h") {
		$(id).attr("value", "h").html('小时<span class="caret"></span>');
	} else {
		$(id).attr("value", "d").html('天<span class="caret"></span>');
	}
}

function unitTime(t) {
	var time = parseInt(t),
		min = parseInt(time / 60),
		rt = min,
		unit = "m";

	if ((min % 60) == 0) {
		rt = parseInt(min / 60);
		unit = "h";
	}
	if ((min % 1440) == 0) {
		rt = parseInt(min / 1440);
		unit = "d";
	}
	return {
		time: rt,
		unit: unit
	};
}

function getIpgroup(func) {
	var cgiobj = {
		"page": 1,
		"count": 10000,
		"order": "ipgrpname",
		"desc": 1,
		"search": "ipgrpname",
		"link": "all"
	}
	cgicall.get("ipgroup_get", cgiobj, func);
}

function edit(that) {
	modify_flag = "mod";
	$('#rulename').prop("disabled", true);

	getIpgroup(function(d) {
		if (d.status == 0) {
			var str = "",
				data = d.data,
				node = $(that).closest("tr"),
				obj = oTabAuth.api().row(node).data();

			for (var i = 0, ien = data.length; i < ien; i++) {
				str += "<option value='" + data[i]["ipgid"] + "'>" + data[i]["ipgrpname"] + "</option>";
			}
			$("#ipgid").html(str);
			jsonTraversal(obj, jsTravSet);
			OnIscloud();

			$('#modal_edit').modal("show");
		} else {
			createModalTips("获取IP组失败！请尝试重新加载！");
		}
	});
}

function set_enable(that) {
	var node = $(that).closest("tr");
	var obj = oTabAuth.api().row(node).data();
	if (obj.enable == "1") {
		obj.enable = "0"
	} else {
		obj.enable = "1"
	}

	cgicall.post("authrule_set", obj, function(d) {
		cgicallBack(d, initData, function() {
			createModalTips("修改失败！" + (d.data ? d.data : ""));
		});
	})
}

function DoSave() {
	var obj = {
		"enable": "",
		"rulename": "",
		"ruledesc": "",
		"zid": "",
		"ipgid": "",
		"iscloud": "",
		"authtype": "",
		"white_ip": "",
		"white_mac": "",
		"redirect":"",//????
		"modules": {
			"web": 0,
			"wechat": 0,
			"sms": 0
		},
		"wechat": {
			"shop_name": "",
			"ssid": "",
			"shop_id": "",
			"appid": "",
			"secretkey": ""
		},
		"sms": {
			"sms": ""
		}
	}
	if (!verification("#modal_edit")) return;
	var url = $.trim($("#redirect").val());
	if (url.substring(0, 7) != "http://" && url.substring(0, 8) != "https://" && url != "") {
		url = "http://" + url;
	}
	var data = jsonTraversal(obj, jsTravGet);
	data.redirect = url;
	data.white_mac = data.white_mac.length == 0 ? [] : data.white_mac.split("\n");
	data.white_ip = data.white_ip.length == 0 ? [] : data.white_ip.split("\n");
	data.zid = "0";

	if (data.authtype == "web" && data.modules.web == 0 && data.modules.wechat == 0 && data.modules.sms == 0) {
		alert("认证方式至少选择一个！");
		return false;
	}

	if (modify_flag == "add") {
		cgicall.post("authrule_add", data, function(d) {
			cgicallBack(d, initData, function() {
				createModalTips("添加失败！" + (d.data ? d.data : ""));
			});
		});
	} else {
		data.zid = $("#zid").val();
		data.rid = $("#rid").val();
		data.priority = $("#priority").val();
		cgicall.post("authrule_set", data, function(d) {
			cgicallBack(d, initData, function() {
				createModalTips("修改失败！" + (d.data ? d.data : ""));
			});
		});
	}
}

function rowMove(set, id) {
	var data,
		num,
		arr = [],
		sarr = [];

	data = oTabAuth.api().rows().data();
	for (var i = 0; i < data.length; i++) {
		if (data[i].rid == id) {
			num = i;
		}
		arr.push(data[i].rid);
	}

	if (set == "up") {
		if (num == 0) {
			createModalTips("第一条，不能移动！");
			return;
		}
		id2 = arr[num - 1];
		sarr = [id2, id];
	} else if (set == "down") {
		if (num == data.length - 1) {
			createModalTips("最后一条，不能移动！");
			return;
		}
		id2 = arr[num + 1];
		sarr = [id, id2];
	}

	cgicall.post("authrule_adjust", {rids: sarr}, function(d) {
		cgicallBack(d, initData, function() {
			createModalTips("移动失败！" + (d.data ? d.data : ""));
		});
	});
}

function DoDelete() {
	var idarr = [];
	for (var i = 0, ien = nodeEdit.length; i < ien; i++) {
		idarr.push(nodeEdit[i].rid);
	}
	cgicall.post("authrule_del", {"rids": idarr}, function(d) {
		cgicallBack(d, initData, function() {
			createModalTips("删除失败！" + (d.data ? d.data : ""));
		});
	});
}

function initEvents() {
	$('.add').on('click', OnAddAuth);
	$('.delete').on('click', function() { OnDelete(); });
	$('.submit').on('click', OnSubmit);
	$(".checkall").on("click", OnSelectAll);
	$(".dropdown-menu a").on("click", OnUnitChange)
	$('fieldset.form-ff legend').on('click', OnLegend);
	$("input:radio[name='authtype']").on("change", OnTypeChange);
	$("input:radio[name='offline']").on("change", OnOfflineChange);
	$("#iscloud").on("click", OnIscloud);
	$(".checkbox.modules").on("click", OnChecked);
	$('[data-toggle="tooltip"]').tooltip();
}

function OnAddAuth() {
	modify_flag = "add";
	$("#rulename").prop("disabled", false);
	$("#enable").prop("checked", true);
	$("#authtype").prop("checked", true);

	getIpgroup(function(d) {
		if (d.status == 0) {
			var str = "",
				data = d.data;

			$('#rulename, #ruledesc').val("");

			for (var i = 0, ien = data.length; i < ien; i++) {
				str += "<option value='" + data[i]["ipgid"] + "'>" + data[i]["ipgrpname"] + "</option>";
			}
			$("#ipgid").html(str);

			OnIscloud();
			$('#modal_edit').modal("show");
		} else {
			createModalTips("获取IP组失败！请尝试重新加载！");
		}
	});
}

function OnSubmit() {
	if (!verification(".g-config")) return;

	var obj = {
			auth_no_flow_timeout: "",
			auth_offline_time: "",
			auth_redirect_ip: "",
			auth_bypass_dst: ""
		},
		data = jsonTraversal(obj, jsTravGet),
		arr = data.auth_bypass_dst.split("\n"),
		sarr = [];

	for (var i = 0; i < arr.length; i++) {
		if ($.trim(arr[i]).length == 0) continue;
		var s = arr[i].replace(/\s/g,'');
		if (typeof s != "undefined" && s && $.trim(s) != "") {
			sarr.push(s);
		}
	}
	data.auth_bypass_dst = sarr;

	var unit_no_flow = $(".unit-no-flow").attr("value"),
		unit_offline = $(".unit-offline").attr("value"),
		noflow = isNaN(parseInt(data.auth_no_flow_timeout)) ? 0 : parseInt(data.auth_no_flow_timeout),
		offline = isNaN(parseInt(data.auth_offline_time)) ? 0 : parseInt(data.auth_offline_time);

	if (unit_no_flow == "m") {
		data.auth_no_flow_timeout = noflow * 60;
	} else if (unit_no_flow == "h") {
		data.auth_no_flow_timeout = noflow * 60 * 60;
	} else {
		data.auth_no_flow_timeout = noflow * 60 *60 *24;
	}
	if (unit_offline == "m") {
		data.auth_offline_time = offline * 60;
	} else if (unit_offline == "h") {
		data.auth_offline_time = offline * 60 * 60;
	} else {
		data.auth_offline_time = offline * 60 *60 *24;
	}

	var enabled = $("input:radio[name=offline]:checked").val();
	var sobj = {
		auth_no_flow_timeout: {
			enable: enabled == "no_flow" ? 1 : 0,
			time: data.auth_no_flow_timeout
		},
		auth_offline_time: {
			enable: enabled == "no_flow" ? 0 : 1,
			time: data.auth_offline_time
		},
		auth_redirect_ip: data.auth_redirect_ip,
		auth_bypass_dst: data.auth_bypass_dst
	}

	cgicall.post("kv_set", sobj, function(d) {
		cgicallBack(d, function() {
			initData2();
			createModalTips("保存成功！");
		}, function() {
			createModalTips("保存失败！" + (d.data ? d.data : ""));
		});
	});
}

function OnSelectAll() {
	dtSelectAll(this, oTabAuth);
}

function OnDelete(that){
	getSelected(that);
	if (nodeEdit.length == 0) {
		createModalTips("请选择要删除的列表！");
		return;
	}

	createModalTips("删除后不可恢复。</br>确定要删除？", "DoDelete");
}

function OnChecked() {
	if ($("input:radio[name='authtype']:checked").val() == "auto") {
		return;
	}
	var wechat = $("#modules__wechat").is(":checked");
	var sms = $("#modules__sms").is(":checked");

	if (!wechat && !sms) {
		$(".tab-content input").prop("disabled", true);
		$(".auth-modules").slideUp(300);
	} else if (wechat && sms) {
		doshow("tabs_wechat", false);
		$(".tabs_sms").show().removeClass("active");
		$("#tabs_sms").removeClass("active").find("input").prop("disabled", false);
		$(".auth-modules").slideDown(300);
	} else if (wechat) {
		doshow("tabs_wechat", false);
		doshow("tabs_sms", true);
		$(".auth-modules").slideDown(300);
	} else if (sms) {
		doshow("tabs_sms", false);
		doshow("tabs_wechat", true);
		$(".auth-modules").slideDown(300);
	}

	function doshow(node, f) {
		if (f) {
			$("." + node).hide().removeClass("active");
			$("#" + node).removeClass("active").find("input").prop("disabled", true);
		} else {
			$("." + node).show().addClass("active");
			$("#" + node).addClass("active").find("input").prop("disabled", false);
		}
	}
}

function disCheckbox(f, e) {
	var sec = e ? 300 : 0;
	$(".checkbox.modules").find("input").prop("disabled", f);
	if (f) {
		$(".auth-modules").slideUp(sec);
		$(".tab-content input").prop("disabled", true);
	} else {
		OnChecked();
		if ($("#modules__wechat").is(":checked") || $("#modules__sms").is(":checked")) {
			$(".auth-modules").slideDown(sec);
		}
	}
}

function OnTypeChange(e) {
	var check = $("input:radio[name='authtype']:checked").val();
	if (check == "auto") {
		disCheckbox(true, e);
	} else {
		disCheckbox(false, e);
	}
}
function OnOfflineChange() {
	var value = $("input[name='offline']:checked").val();
	if (value == "no_flow") {
		$("#auth_no_flow_timeout").prop("disabled", false);
		$("#auth_offline_time").prop("disabled", true);
	} else {
		$("#auth_no_flow_timeout").prop("disabled", true);
		$("#auth_offline_time").prop("disabled", false);
	}
}
function OnIscloud(e) {
	var sec = e ? 300 : 0;
	if ($("#iscloud").is(":checked")) {
		$(".iscloud").slideUp(sec).find("input").prop("disabled", true);
	} else {
		OnTypeChange(false);
		$("input:radio[name='authtype'], #redirect").prop("disabled", false);
		$(".iscloud").slideDown(sec);
	}
}

function OnLegend() {
	var t = $(this).siblings(".form-hh");
	if (t.is(":hidden")) {
		$(this).find("span i").removeClass("icon-double-angle-down").addClass("icon-double-angle-up");
		t.slideDown(300);
	} else {
		$(this).find("span i").removeClass("icon-double-angle-up").addClass("icon-double-angle-down");
		t.slideUp(300);
	}
}

function OnUnitChange() {
	var unit;
	var that = $(this);
	if(that.text() == "分钟") {
		unit = "m";
	} else if(that.text() == "小时") {
		unit = "h";
	} else if(that.text() == "天") {
		unit = "d";
	}
	that.parents(".btn-group").find(".dropdown-toggle").attr("value", unit).html(that.text()+"<span class='caret'>");
}

function getSelected(that) {
	nodeEdit = [];
	if (that) {
		var node = $(that).closest("tr");
		var data = oTabAuth.api().row(node).data();
		nodeEdit.push(data);
	} else {
		nodeEdit = dtGetSelected(oTabAuth);
	}
}

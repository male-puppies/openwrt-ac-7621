local fp 	= require("fp")
local ski 	= require("ski")
local log 	= require("log")
local js 	= require("cjson.safe")
local rpccli 	= require("rpccli")
local simplesql = require("simplesql")

local rid_map = {}
local simple, udpsrv, mqtt

-------------------------------------------- common ------------------------------------------------
local clear_map = {}
local function init(u, p)
	udpsrv, mqtt = u, p
	local dbrpc = rpccli.new(mqtt, "a/local/database_srv")
	simple = simplesql.new(dbrpc)
end

local function clear(tbname, action)
	local f = clear_map[tbname]
	local _ = f and f(action)
end

---------------------------------------- memo.online ---------------------------------------------
local online_cache

-- 如果没有初始化online_cache，从memo.online初始化
local function check_module()
	if online_cache then
		return
	end

	local rs, e = simple:mysql_select("select ukey,type from memo.online") 	assert(rs, e)
	online_cache = fp.reduce(rs, function(t, r) return rawset(t, r.ukey, r.type) end, {})
	print("init mod",  js.encode(online_cache))
end

local function set_module(ukey, mod)
	print(ukey, mod)
	check_module()
	if not online_cache[ukey] then
		online_cache[ukey] = mod
	end
	print("set_module", js.encode(online_cache))
end

local function get_module(ukey)
	check_module()
	return online_cache[ukey]
end

---------------------------------------------- kv ---------------------------------------------
local kv_cache
local fields = {"offline_time", "redirect_ip"}

local function check_kv()
	if kv_cache then
		return
	end

	local narr = fp.reduce(fields, function(t, v) return rawset(t, #t + 1, string.format("'%s'", v)) end, {})
	local sql = string.format("select k,v from kv where k in (%s)", table.concat(narr, ","))
	local rs, e = simple:mysql_select(sql)		assert(rs, e)
	kv_cache = fp.reduce(rs, function(t, r) return rawset(t, r.k, r.v) end, {})
end

local function kv_get_common(field)
	check_kv()
	return kv_cache[field]
end

local function offline_time()
	return tonumber(kv_get_common("offline_time"))
end

local function redirect_ip()
	return kv_get_common("redirect_ip")
end

function clear_map.kv(action)
	kv_cache = nil
	log.debug("clear kv_cache %s", js.encode(action))
end

---------------------------------------------- authrule ---------------------------------------------
local authrule_cache

function clear_map.authrule(action)
	authrule_cache = nil
	log.debug("clear authrule_cache %s", js.encode(action))
end

local function check_authrule()
	if authrule_cache then
		return
	end

	local rs, e = simple:mysql_select("select * from authrule")		assert(rs, e)
	authrule_cache = fp.tomap(rs, "rid")
end

local function authrule(rid)
	check_authrule()
	return authrule_cache[rid]
end

------------------------------------------------ end ---------------------------------------------------

return {
	init 			= init,
	clear 			= clear,

	set_module 		= set_module,
	get_module 		= get_module,

	offline_time 		= offline_time,
	redirect_ip 		= redirect_ip,

	authrule 		= authrule,
}
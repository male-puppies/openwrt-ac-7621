#
# Copyright (C) 2008-2010 OpenWrt.org
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk
include $(INCLUDE_DIR)/kernel.mk

PKG_NAME:=nproto
PKG_RELEASE:=3

include $(INCLUDE_DIR)/package.mk

define KernelPackage/nproto
  CATEGORY:=Puppies
  SUBMENU:=Nos kernel modules
  TITLE:=nos track proto identify kernel driver
  FILES:=$(PKG_BUILD_DIR)/nproto.ko
  DEPENDS:=+kmod-klog +kmod-ipt-ipset +pps_comm
  AUTOLOAD:=$(call AutoProbe, nproto)
  KCONFIG:=
endef

define KernelPackage/nproto/description
  Kernel module to package identify system.
endef

EXTRA_KCONFIG:= \
	CONFIG_NPROTO=m 

EXTRA_CFLAGS:= \
	$(patsubst CONFIG_%, -DCONFIG_%=1, $(patsubst %=m,%,$(filter %=m,$(EXTRA_KCONFIG)))) \
	$(patsubst CONFIG_%, -DCONFIG_%=1, $(patsubst %=y,%,$(filter %=y,$(EXTRA_KCONFIG)))) \
	-Werror -Wall

MAKE_OPTS:= \
	ARCH="$(LINUX_KARCH)" \
	CROSS_COMPILE="$(TARGET_CROSS)" \
	SUBDIRS="$(PKG_BUILD_DIR)" \
	EXTRA_CFLAGS="$(EXTRA_CFLAGS)" \
	$(EXTRA_KCONFIG)

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) ./src/* $(PKG_BUILD_DIR)/
endef

define Build/Compile
	$(MAKE) -C "$(LINUX_DIR)" \
		$(MAKE_OPTS) \
		modules
endef

$(eval $(call KernelPackage,nproto))

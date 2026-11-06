---
title: 容器配置ssh远程登录
categories:
  - docker
tags: []
date: 2026-03-15 23:11:29
---
容器配置 ssh 远程登录


[Docker 容器配置远程登录](https://blog.51cto.com/u_12907475/5289335)

[https://blog.51cto.com/u\_12907475/5289335](https://blog.51cto.com/u_12907475/5289335)

## Docker 容器配置远程登录

## 前言

docker 的网络模式主要有三种，bridge、host、none；

* bridge 是 docker 安装后自动创建的虚拟网卡，创建容器时默认使用此模式。
* host 是指容器与宿主机共用宿主机的网络
* none 是指不创建网络
* 查看 docker 的网络模式​​docker network ls​​​

![](/images/asynccode_1773587504807.png)

docker 默认的网卡不支持固定 ip，需自定义网络，使用自定义的网络来固定 ip

* 创建自定义网络​​docker network create ​​
* 删除自定义网络​​docker network rm​​
* 查看网卡信息​​docker network inspect ​​​

![](/images/asynccode_1773587506742.png)

## 1、创建自定义网络

* --subbet Ip 地址
* --gateway 网关
* docker-br0 是自定义网络名称

![](/images/asynccode_1773587508020.png)

## 2、创建容器

* -i 交互模式
* -d 后端运行
* -h 容器的 hostname
* --network 网卡
* --ip IP 地址
* -p 端口映射
* --privileged=true 和 /usr/sbin/init 为特权模式参数

![](/images/asynccode_1773587508609.png)

## 3、进入容器安装 ssh 服务及必要的依赖包

```Plain%20Text
[root@docker /]# docker exec -it oracle11g /bin/bash
[root@oracledb /]# yum -y update # 更新yum
[root@oracledb /]# yum -y install openssl openssh-server openssh-clients
```

![](/images/asynccode_1773587509235.png)

![](/images/asynccode_1773587509988.png)

## 4、修改 ssh 服务配置文件

```Plain%20Text
[root@oracledb /]# vi /etc/ssh/sshd_config
```

* 取消​​PermitRootLogin yes​​​的注释

![](/images/asynccode_1773587511095.png)

## 5、启动 sshd 服务

```Plain%20Text
[root@oracledb /]# netstat -lnp | grep 22  
[root@oracledb /]# systemctl restart sshd  # 重启sshd服务
[root@oracledb /]# systemctl enable sshd   # 开机启动sshd服务
```

![](/images/asynccode_1773587513893.png)

## 6、配置容器的 root 用户密码

![](/images/asynccode_1773587514668.png)

## 7、验证

查看宿主机 1122 端口，已监听

```Plain%20Text
netstat -lnp | grep 22
```

![](/images/asynccode_1773587516352.png)

xshell 远程连接测试

![](/images/asynccode_1773587517176.png)

使用宿主机的 1122 端口远程访问

![](/images/asynccode_1773587518164.png)


---
title: Docker快速入门
categories:
  - docker
date: 2026-03-15 23:06:52
tags:
---
Docker 快速入门

# 概述

开源的的容器引擎

![](/images/asynccode_1773587214820.png)

# 命令

## Docker 服务

* 启动

systemctl start docker

* 关闭

systemctl stop docker

* 重启

systemctl restart docker

* 状态

systemctl status docker

* 开机启动

systemctl enable docker

## 镜像相关

* 查看

docker images

* 搜索

docker search redis

* 拉取

docker pull redis:5.6

* 删除

docker rmi [image id]/name:tag

docker rmi \`docker images -q\`

## 容器

* 查看

docker ps

docker ps -a

docker inspect [容器 id]

* 创建

docker run -it --name=xxx centos /bin/bash

-i: 保持运行

-t: 分配终端

-d: 不进入容器,退出不关闭

--name=: 指定名字

* 进入

docker exec -it c2 /bin/bash

* 启动

docker start 容器 id

* 停止

docker stop 容器 id

* 删除

docker rm [容器 id/名字]

docker rm \`docker ps -q\`

docker rm -f [容器 id]

# 容器数据卷

数据卷可理解成文件或者目录

## 概念

当容器内的目录或文件与宿主机的目录或文件绑定时，宿主机的目录或文件成为数据卷。数据卷的数据与容器内的数据同步，容器删除时，数据卷不会删除，多个容器可以挂载同一个数据卷。一个容器也可以挂载多个数据卷

![](/images/asynccode_1773587217318.png)

## 配置数据卷

在创建或启动容器时使用 -v 参数 设置数据卷

docker run -v 宿主机目录（文件）: 容器内目录（文件）...

注意：

* 目录必须是绝对路径
* 目录不存在会自动创建
* 可以挂载多个数据卷

## 数据卷容器

多容器进行数据交换，可以多容器挂载同一个数据卷，但是比较麻烦，所以 docker 提供了数据卷容器

![](/images/asynccode_1773587218822.png)

# 应用部署

* ## mysql
* tomcat
* nginx
* redis

# dockerfile

## 镜像原理

![](/images/asynccode_1773587219469.png)

![](/images/asynccode_1773587220221.png)

![](/images/asynccode_1773587223148.png)

# 镜像制作

## 容器转镜像

docker commit 容器 id 镜像名称:b 版本号

docker save -o 压缩文件名称 镜像名称:版本号

docker load -i 压缩文件名称

## dockerfile

![](/images/asynccode_1773587223645.png)

学习方法：

照着别人的写

**无法复制加载中的内容**

docker build -f ./dockerfile -t app:1 .

-f 指定 dockerfile 文件路径

-t 指定镜像名称和路径

## docker compose 服务编排

![](/images/asynccode_1773587225728.png)

![](/images/asynccode_1773587226354.png)

# 私有仓库

# 相关文档

**https://docker.easydoc.net/doc/81170005/cCewZWoN/XQEqNjiu**


---
title: docker run /bin/bash和/usr/sbin/init区别
categories:
  - docker
date: 2026-03-15 23:09:40
tags:
---
docker run /bin/bash 和/usr/sbin/init 区别

> 🔗 原文链接：[https://blog.csdn.net/Dontla/articl...](https://blog.csdn.net/Dontla/article/details/125310028)


首先，[docker](https://so.csdn.net/so/search?q=docker&spm=1001.2101.3001.7020) run -it centos 的意思是，为 centos 这个镜像创建一个容器

-it 就等于 -i 和-t，这两个参数的作用是，为该 docker 创建一个伪终端，这样就可以进入到容器的交互模式？（也就是直接进入到容器里面）

后面的/bin/bash 的作用是表示载入容器后运行 bash ,docker 中必须要保持一个进程的运行，要不然整个容器启动后就会马上 kill itself，这个/bin/bash 就表示启动容器后启动 bash。

> [参考文章：docker run -it centos /bin/bash 后面的 bin/bash 的作用](https://blog.csdn.net/persistencegoing/article/details/93713869)

/usr/sbin/init 启动容器之后可以使用 systemctl 方法

--privileged=true 获取宿主机 root 权限（特殊权限-）

su 命令和 su -命令最大的本质区别就是：前者只是切换了 root 身份，但 Shell 环境仍然是普通用户的 Shell；而后者连用户和 Shell 环境一起切换成 root 身份了。

> [参考文章：docker -privileged 和/usr/sbin/init](https://www.cnblogs.com/lph970417/p/14754072.html)

> /usr/sbin/init：初始容器里的 CENTOS，用于启动 dbus-daemon

> [参考文章：Docker 容器 Centos 不能使用 systemctl 命令问题](https://www.cnblogs.com/chloneda/p/bug-dock-os.html)



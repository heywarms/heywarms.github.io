---
title: docker宿主机与容器传递文件 cp 命令
categories:
  - docker
date: 2026-03-15 23:10:48
tags:
---
# docker 中宿主机与容器互相拷贝传递文件

### 1 从容器拷贝文件到宿主机：

```Plain%20Text
docker cp 容器名:容器中要拷贝的文件名及其路径 要拷贝到宿主机里面对应的路径
```

例如，将容器 mycontainer 中路径 /opt/testnew/ 下的文件 file.txt 拷贝到宿主机的 /opt/test/，在宿主机中执行命令如下：

```Plain%20Text
docker cp mycontainer:/opt/testnew/file.txt /opt/test/
```

### 2 从宿主机拷贝文件到容器：

```Plain%20Text
docker cp 宿主机中要拷贝的文件名及其路径 容器名:要拷贝到容器里面对应的路径
```

例如，将宿主机中路径 /opt/test/ 下的文件 file.txt 拷贝到容器 mycontainer 的 /opt/testnew/ 路径下，同样还是在宿主机中执行命令如下：

```Plain%20Text
docker cp /opt/test/file.txt mycontainer:/opt/testnew/
```


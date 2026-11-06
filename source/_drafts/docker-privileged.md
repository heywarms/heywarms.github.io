---
title: docker--privileged
categories:
  - docker
date: 2026-03-15 23:08:40
tags:
---
> 🔗 原文链接：[https://blog.csdn.net/zhou920786312...](https://blog.csdn.net/zhou920786312/article/details/119713645)
> 
> # docker--privileged

# 一、 privileged=true|false 介绍

1. true
   1. container 内的 root 拥有真正的 root 权限。
2. false
   1. container 内的 root 只是外部的一个普通用户权限。
   2. 默认 false
3. privileged 启动的容器
   1. 可以看到很多 host 上的设备
   2. 可以执行 mount。
   3. 可以在 docker 容器中启动 docker 容器。

# 二、测试验证

## 2.1、未设置 privileged 启动的容器

```Plain%20Text
docker run -it centos:7.7.1908 bash
```

![](/images/asynccode_1773587339997.png)

#### 不可以执行 mount

```Plain%20Text
mount /dev/vdb3 /mnt/
```

![](/images/asynccode_1773587340484.png)

## 2.2、设置 privileged 启动的容器

```Plain%20Text
docker run -it --privileged=true centos:7.7.1908 bash
```

#### 可以执行 mount

```Plain%20Text
mount /dev/vda1   /dev/shm
```

![](/images/asynccode_1773587340985.png)

---

显示推荐内容


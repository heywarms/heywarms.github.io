---
title: MySql死锁问题
categories:
  - MySql
date: 2026-03-15 23:02:59
tags:
---
当业务并发程度高时可能就会遇到死锁问题，为了防止遇到这些问题变成鸵鸟，介绍一下如何解决死锁问题。

## 了解 mysql 的加锁原理

mysql 的锁是基于索引的，如果未加索引会使用表级锁。隔离级别是 RC，在 Innodb 引擎下支持行级锁。当**使用索引**进行插入、更新、或者 select ...from where xxxx for update 时会对对应的记录加上行级锁。

![image_1773587011928.png](/images/image_1773587011928.png)

## 模拟产生死锁

## 1 创建一张表

```SQL
create table user (
    id bigint unsigned auto_increment comment '主键',
    name varchar(255) not null comment '姓名',
    age int not null  comment  '年龄',
    primary key (id)
) engine=InnoDB charset=utf8mb4;
```

## 2 初始化数据

```SQL
insert into user (name, age) VALUES ('张三', 23);
insert into user (name, age) VALUES ('李四', 24);
insert into user (name, age) VALUES ('王五', 25);
```

![](/images/asynccode_1773586982694.png)

## 3 事物执行

开启两个终端按照以下顺序执行 sql，执行到第 6 条命令，mysql 死锁检测机制检测到死锁，选择一个事务回滚，并报错

```Plain
ERROR 1213 (40001): Deadlock found when trying to get lock; try restarting transaction
```

| 执行顺序 | 事物 1                                        | 事物 2                                       |
| ---------- | ----------------------------------------------- | ---------------------------------------------- |
| 1        | begin;                                        |                                             |
| 2        |                                              | begin;                                       |
| 3        | select  \* from user where id = 1 for update; |                                             |
| 4        |                                              | select \* from user where id = 3 for update; |
| 5        | select \* from user where id = 3 for update;  |                                             |
| 6        |                                              | select \* from user where id = 1 for update; |

![](/images/asynccode_1773586983220.png)

## 分析

![image_1773587088699.png](/images/image_1773587088699.png)

## 死锁问题的排查

## 查看死锁日志

终端输入 `show engine innodb status` 显示 Innodb 存储引擎的状态信息，里面就包含了最近发生死锁的日志信息

```Bash
------------------------
LATEST DETECTED DEADLOCK
------------------------
# 死锁发生的时间
2022-10-08 13:08:11 0x7f4e942bf700
# 与死锁相关的第一个事务信息
*** (1) TRANSACTION:
# 事物ID，以及事务的活跃时间38秒，操作为 starting index read
TRANSACTION 2853, ACTIVE 38 sec starting index read
# 此事务使用了一个表，为一个表上了一个锁
mysql tables in use 1, locked 1
# 此事物 处于 lock wait 状态， 三个 锁结构 2个行级锁，1个表级意向锁，申请了heap size的大小
LOCK WAIT 3 lock struct(s), heap size 1136, 2 row lock(s)
MySQL thread id 11, OS thread handle 139975469815552, query id 1882 localhost root statistics
# 发生阻塞的 sql 语句
select  * from user where id = 3 for update
*** (1) WAITING FOR THIS LOCK TO BE GRANTED:
RECORD LOCKS space id 28 page no 3 n bits 72 index PRIMARY of table `test`.`user` trx id 2853 lock_mode X locks rec but not gap waiting
Record lock, heap no 4 PHYSICAL RECORD: n_fields 5; compact format; info bits 0
 主键值
 0: len 8; hex 0000000000000003; asc         ;;
 1: len 6; hex 000000000b24; asc      $;;
 2: len 7; hex ba0000012f0110; asc     /  ;;
 3: len 6; hex e78e8be4ba94; asc       ;;
 4: len 4; hex 80000019; asc     ;;
# 第二个事务信息
*** (2) TRANSACTION:
TRANSACTION 2854, ACTIVE 27 sec starting index read
mysql tables in use 1, locked 1
3 lock struct(s), heap size 1136, 2 row lock(s)
MySQL thread id 10, OS thread handle 139975470085888, query id 1883 localhost root statistics
select * from user where id = 1 for update
*** (2) HOLDS THE LOCK(S):
RECORD LOCKS space id 28 page no 3 n bits 72 index PRIMARY of table `test`.`user` trx id 2854 lock_mode X locks rec but not gap
Record lock, heap no 4 PHYSICAL RECORD: n_fields 5; compact format; info bits 0
 0: len 8; hex 0000000000000003; asc         ;;
 1: len 6; hex 000000000b24; asc      $;;
 2: len 7; hex ba0000012f0110; asc     /  ;;
 3: len 6; hex e78e8be4ba94; asc       ;;
 4: len 4; hex 80000019; asc     ;;

*** (2) WAITING FOR THIS LOCK TO BE GRANTED:
RECORD LOCKS space id 28 page no 3 n bits 72 index PRIMARY of table `test`.`user` trx id 2854 lock_mode X locks rec but not gap waiting
Record lock, heap no 2 PHYSICAL RECORD: n_fields 5; compact format; info bits 0
 0: len 8; hex 0000000000000001; asc         ;;
 1: len 6; hex 000000000b1e; asc       ;;
 2: len 7; hex b60000012a0110; asc     *  ;;
 3: len 6; hex e5bca0e4b889; asc       ;;
 4: len 4; hex 80000017; asc     ;;

*** WE ROLL BACK TRANSACTION (2)
```


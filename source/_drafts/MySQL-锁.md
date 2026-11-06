---
title: MySQL 锁
categories:
  - MySql
date: 2026-03-15 22:43:02
tags:
---
# 概述

在锁可以用来控制多个进程或者线程对共享资源的访问，确保并发访问的一致性和有效性。数据库中的数据也是多用户共享的资源，所用来控制事务的并发访问。

MySQL 中锁的粒度分类：

* 全局锁：锁定数据库中的所有表
* 表级锁：锁定整张表
* 行级锁：锁定表中的某一行数据

# 全局锁

对整个数据库的实例加锁，整个实例处于只读状态，DML、DDL 都会被阻塞。

应用场景：全库逻辑备份

![](/images/asynccode.png)

![](/images/asynccode_1773586723686.png)

## 语法

* 加全局锁

```SQL
flush tables with read lock ;
```

* 数据备份

```SQL
mysqldump -uroot –p1234 库名 > 文件名.sql
```

* 释放锁

```SQL
unlock tables ;
```

## 存在的问题

* 主库备份
  业务停摆
* 从库备份

主从数据不一致

在 InnoDB 引擎中，我们可以在备份时加上参数 --single-transaction 参数来完成不加锁的一致

性数据备份

```Bash
mysqldump --single-transaction -uroot –p123456 itcast > itcast.sql
```

# 表级锁

每次操作对整张表加锁，粒度大，并发度低。

分类：

* 表锁
* 元数据锁
* 意向锁

## 1.表锁

* 表共享读锁（read lock）
* 表独占写锁（write lock）

### 语法

* 加锁

```Bash
lock tables 表名... read/write。
```

* 释放锁

```Bash
unlock tables / 客户端断开连接
```

### 特点

* 读锁

![](/images/asynccode_1773586724046.png)

试验：

![](/images/asynccode_1773586724478.png)

![](/images/asynccode_1773586725166.png)

* 写锁

![](/images/asynccode_1773586725505.png)

![](/images/asynccode_1773586725854.png)

## 2.元数据锁

meta data lock，简称 MDL

加锁过程系统自动控制，在访问一张表的时候就会加上。用于维护表元数据的一致性，在表上有活动的事务的时候，不可以对表元数据操作。防止 DML 与 DDL 冲突。

增删改查加 MDL 共享读锁，对表结构改变加 MDL 写锁（排他）。

| **对应 SQL ​**                         | 锁类型                                      | **说明**                                        |
| ----------------------------------------------- | --------------------------------------------- | ------------------------------------------------------- |
| lock tables xxx read / write                  | SHARED\_READ\_ONLY /SHARED\_NO\_READ\_WRITE |                                                      |
| select 、select ...lock in share mode        | SHARED\_READ                               | 与 SHARED\_READ、SHARED\_WRITE 兼容，与EXCLUSIVE 互斥 |
| insert 、update、delete、select ... forupdate | SHARED\_WRITE                              | 与 SHARED\_READ、SHARED\_WRITE 兼容，与EXCLUSIVE 互斥 |
| alter table ...                               | EXCLUSIVE                                   | 与其他的 MDL 都互斥                                   |

试验：

```SQL
select object_type,object_schema,object_name,lock_type,lock_duration from 
performance_schema.metadata_locks ;
```

![](/images/asynccode_1773586726235.png)

## 3.意向锁

解决执行 DML 语句时，加的行锁和表锁的冲突。

![](/images/asynccode_1773586726762.png)![](/images/asynccode_1773586727224.png)

![](/images/asynccode_1773586727633.png)

![](/images/asynccode_1773586728034.png)

分类：

* 意向共享锁 IS

与表共享读锁（read）兼容，与表排他锁 （写锁）冲突。使用 select ... lock in share mode 添加 IS。

* 意向排他锁 IX

由 insert、update、delete、select...for update 添加 。与表锁共享锁(read)及排他锁(write)都互斥，意向锁之间不会互斥。

> 一旦事务提交了，意向共享锁、意向排他锁，都会自动释放。

试验：

```SQL
select object_schema,object_name,index_name,lock_type,lock_mode,lock_data from 
performance_schema.data_locks;
```

![](/images/asynccode_1773586728464.png)

# 行级锁

每次操作锁定对应行的数据。锁的粒度最小，并发性好。innodb 引擎支持行级锁。

InnoDB 的数据是基于索引组织的，行锁是通过对索引上的索引项加锁来实现的，而不是对记录加的

锁。

* 行锁（record lock）

锁定某一行的记录，防止其他的事务对这一行数据更新，在 RC，RR 模式下支持

![](/images/asynccode_1773586728782.png)

* 间隙锁（Gap lock）

锁定索引记录的间隙（不含该记录），保证索引的间隙不会被改变，防止其他事务对这个间隙进行插入产生幻读，在 RR 隔离级别下面支持。

![](/images/asynccode_1773586729157.png)

* 临键锁

行锁和间隙锁的组合，锁住行数据的同时，锁住数据前面的间隙，RR 隔离级别下支持。

![](/images/asynccode_1773586729461.png)

## 1.行锁

* 共享锁 S

允许事实去读一行数据，阻止其他事务获取相同数据集的排他锁

* 排他锁 X

允许获取排他锁的事务更新数据，阻止其他事务获取共享锁和排他锁

![](/images/asynccode_1773586729717.png)

SQL 语句加锁情况

![](/images/asynccode_1773586730382.png)

试验：

默认情况下，InnoDB 在 REPEATABLE READ 事务隔离级别运行，InnoDB 使用 next-key 锁进行搜

索和索引扫描，以防止幻读。

* 针对唯一索引进行检索时，对已存在的记录进行等值匹配时，将会自动优化为行锁
* InnoDB 的行锁是针对于索引加的锁，不通过索引条件检索数据，那么 InnoDB 将对表中的所有记

录加锁，此时 就会升级为表锁。

查看行锁、意向锁的加锁情况：

```SQL
select object_schema,object_name,index_name,lock_type,lock_mode,lock_data from 
performance_schema.data_locks;
```

a.普通的 select 语句，执行时，不会加锁

b. select...lock in share mode，加共享锁，共享锁与共享锁之间兼容。

c.共享锁与排他锁之间互斥。

d.排他锁之间互斥

![](/images/asynccode_1773586730795.png)![](/images/asynccode_1773586731312.png)

e.无索引升级表锁

![](/images/asynccode_1773586731818.png)![](/images/asynccode_1773586732296.png)

## 2.间隙锁 & 临键锁

默认情况下，InnoDB 在 REPEATABLE READ 事务隔离级别运行，InnoDB 使用 next-key 锁进行搜

索和索引扫描，以防止幻读。

* 使用索引，在不存在的记录上等值查询，优化为间隙锁
* 索引上（普通索引）向右遍历时最后一个值不满足查询需求时，next-key

lock 退化为间隙锁。

![](/images/asynccode_1773586732815.png)

* 索引上的范围查询(唯一索引)--会访问到不满足条件的第一个值为止。

演示：

![](/images/asynccode_1773586733239.png)![](/images/asynccode_1773586733793.png)

![](/images/asynccode_1773586734710.png)


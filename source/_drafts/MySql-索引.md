---
title: MySql 索引
categories:
  - MySql
date: 2026-03-15 23:00:45
tags:
---
## 基本概念

索引是一种数据结构，通过索引可以快速检索数据，避免全表查询。

**暂时无法在飞书文档外展示此内容**

优点：

* 提高查询效率
* 降低数据排序成本

缺点：

* 占空间
* 降低更新表的速度

## 索引的结构

### 1.概述

**暂时无法在飞书文档外展示此内容**

* B+ 树
  * 最常见，大部分引擎支持
* Hash
  * 哈希表实现，只支持精准查询，不支持范围查询
* R-tree
  * MyISAM 引擎的特殊索引类型，用于地理空间类型
* full-text
  * 倒排索引快速匹配文档

### 2.二叉树

二叉树存在退化现象，退化成链表时查询性能大大降低。红黑树解决了平衡问题但是层数还是较深。

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=ZWY3NDMzZDJmOWE4NjMyOTZhODA5ZTE3MTQxNGI3ZGVfMjVqdTRTSTRZYlJ1UU15OHpTaXQwZnRkT1VsbVhKbEJfVG9rZW46Ym94Y25ydm1yTHU5WkdCY0ppQ2pWT3lHY0ZlXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=N2VlZGRmZjE5MTM3MGZjZDEwODNlYzc2Y2YyZTNmMDlfVHdxdEV0SEJpMGl5eFgzSGQyY1M4MG92Tk5MY29SWmhfVG9rZW46Ym94Y25xb0MxcHFIbFZGVTVvdjE5NEpvTllKXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=M2Q2NzMxY2MwY2JiY2UxNDkxNWUwNmVjN2JhMTViOTVfUzluMWM3MGZGcXVKaGNpdjFnNU4zN1dmOG1TMDJNd1RfVG9rZW46Ym94Y250Y3JkdDN6Z3d1alZwbHFiWkl3Qm5jXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

### 3.B 树

多路平衡查找树，例如 max-degree 为 5 阶，每个节点存储 4 个 key 5 个指针

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=ZjU0NzFiNTUwNWY1OGM5ZTI5NmZhNTQ0ZWI3ZmQ1MDhfMHlsdFRHZ1ZINEU2cDVOWk5YUGtlZlQ3SWV5eFE5dENfVG9rZW46Ym94Y24wcGY0VFpReU1LWmhRQUZreGJ6NEZoXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

* 节点中的 key 超过度数时向上分裂
* 非叶子节点和叶子节点都会存放数据
* 每一页中存储的 key 减少，指针减少，保存同样量级的数据，树的高度会更高

### 4.B+ 树

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=NjgzZDIwMTBiYjk1YWJjYjYxYTc0NmJhNDUwZWE4ZDJfSUNnd2RScDE4RzNNbmoyNGc2b01ZNlpJTHVETTBTUGlfVG9rZW46Ym94Y25PNHpRQng2Q2FMaGhQaXhQY3JiVzFnXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

* 所有的数据都出现在叶子节点
* 叶子节点形成一个单向链表
* 非叶子节点只起到数据索引的作用

Mysql 优化后的 B+ 树，增加了一个指向相邻节点的链表指针，利于排序，提高区间访问性能

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=YjBlNGYyZWE3NDdmZmMzMGQyNjUyNThhNmY4ODQ2YjBfbHpzUElPNWdHckdGMEdFdjhvUUQ5UlBDeWhlVks4clVfVG9rZW46Ym94Y25MZ2xqQlpnUlFYVzh6MTZMdmpScEpmXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=N2I0YzAzZTRhMjhhMDk3OGQyODEwMWU1ZThjZWVkOGNfMG93RGIzbFRQaDl6QzJrdG11dzV0WlNXUUtGVGRiU3BfVG9rZW46Ym94Y25uelFZYU9YbjlGeHhCTjBNcmVxNm5jXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

### 5.哈希索引

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=ZjgwNTM2Y2RmOTRlYzUxNmE2NGU1MzMwOWJhYjZjNWVfV1QxVUtOOEY2NW1zTzJzdEJaT0toN2JiOTd3dUF5eERfVG9rZW46Ym94Y253SnE5OFdBbmxmQ0o4TzF5bHJhRWxlXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

* 不支持范围查询，只支持对等比较（=， in），不支持范围查询（between， > , <, ..）
* 查询效率更高

### 5.总结：为什么 Innodb 使用 B+ 树索引

1.相对于二叉树，层级更少

2.相对于 B-树，一页存储的 key 值会更多，树的高度更低

3.相对于 hash 索引，支持范围查询和排序

## 索引分类

### 类型分类

### 存储形式分类

聚簇索引的选取规则：

* 有主键则主键
* 无主键则 fist unique key
* 都无，自动生成 rowid，作为隐藏的聚集索引

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=OGI0ZTZmNWNjMDFjYzdlNDMzZjdhYWJhOGQ3NTVhOTBfd2NLUTVtNkFFMU83d3RFRDk5S25Db2FST0U3WVZRdDJfVG9rZW46Ym94Y25SMFpqWHlDWGJPSnc3MHhIUzN3WnlkXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=ZTE1NTA2MjkxOWZiYzJmMmM3Y2QwMWQ2YTI5ZmMxODRfQkxRTG1LdjRTaHBVcmlGdG5TWjhBcHVLZWp3cDJ2a1VfVG9rZW46Ym94Y24yWWlBOWVoTnBITzI4dENOTHpoa0hSXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

问题 1：

以下两条 SQL 语句，那个执行效率高? 为什么?

A. select \* from user where id = 10 ;

B. select \* from user where name = 'Arm' ;

备注: id 为主键，name 字段创建的有索引；

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=MzE2NTA3MGNhNmNhZWEyZmViZjA2ZDQyNTg5Y2QyODVfVlAxOGtya29vVWJJQTVPSmhzZ1lyZUF2anBvSTAxVzhfVG9rZW46Ym94Y25VSm9lTmpqTkdrc250b0d2M1dQckhjXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

问题 2：

假设:

一行数据大小为 1k，一页中可以存储 16 行这样的数据。InnoDB 的指针占用 6 个字节的空

间，主键即使为 bigint，占用字节数为 8。

高度为 2：

n \* 8 + (n + 1) \* 6 = 16\*1024 , 算出 n 约为 1170

1171\* 16 = 18736

也就是说，如果树的高度为 2，则可以存储 18000 多条记录。

高度为 3：

1171 \* 1171 \* 16 = 21939856

也就是说，如果树的高度为 3，则可以存储 2200w 左右的记录

### 索引语法

* 创建索引

```SQL
CREATE [ UNIQUE | FULLTEXT ] INDEX index_name ON table_name ( 
index_col_name,... ) ;
```

* 显示索引

```SQL
SHOW INDEX FROM table_name ;
```

* 删除索引

```SQL
DROP INDEX index_name ON table_name ;
```

## 索引使用

### 体验：

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=ZTI0YzQ2NzRkZGEzZTc3MzNmMWE5ZTk2NDA4NmIwZDdfUUd0anZPQVhuREVHSHkxd3Rpejc3Vk4wSEZQRElQSVRfVG9rZW46Ym94Y25JZHYzalppaWJ5UGNXQXpMcDU0RFFkXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=NjhkMzhiOWY3N2FmZjgzYzAwODk2ZmIwMzZmYWRiNzRfMXdIUmdEUVNOMEF0UVBPcFNnTDEwOUZ6VVQydm96SUdfVG9rZW46Ym94Y25ncWFTaG1PQXZzYUVDTDBqT1NOeUJiXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

建立索引

```SQL
create index idx_sku_sn on tb_sku(sn);
```

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=OWQ4ZTQ4NWE3MzJmN2UwMjc5YjQ3MjUxMGM4ZDQxZmJfbVVNbU1lNHBmNXRDYmtaajhmVllTTGZzbWd2SldsUk5fVG9rZW46Ym94Y25NSENvaE9WeVp4UlVCT09LWGNtYVhiXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=NmQ2NmU0OTZhODgzNzFkODA5MGFlNDliYjg0NTRlNGFfdlZlYUdoeTRyekJReWRtWUt3MzZnVFZhSnlmaWtLbW9fVG9rZW46Ym94Y25jMEFSemhxT2FuaFNyMkJ4R3RkQU5jXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

### 最左前缀法则

建立联合索引后，查询从索引的最左列开始，不跳过中间的索引列，如果跳过了，则后面的索引无效

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=MTc4OTA4OWExMTBlODJjMTcwYzk2NmYwMjI2ZDdkMzFfbzJxUlJRMXlNSXFuYmhxcGloUXdSek1yWlBPNzdzSTBfVG9rZW46Ym94Y254M05oSmZIRFcwVVpiS1paMmw3eHdkXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

```SQL
create index idx_user_pro_age_sta on tb_user(profession, age, status);
```

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=ZjZlMzRjMjgyMzc4MjEwZjMzN2Y3MGI3MWMxMzE2NmFfVkIzdVlPeWVFWVV2akxOUk5UYTRPTE5xclZsc1oxUU9fVG9rZW46Ym94Y24zNHhicU4xZE1ZOTkxdjM1enFQT3pNXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

```SQL
explain select * from tb_user where profession = '软件工程' and age = 31 and status = '0';
```

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=ODk0YjA2ODhmNDcwNjI3N2YyNDIyNGQzZWJhOTE0ZGRfSnJLVjd2Rm5aUVgwZTFUYjRpS3FGZVNFdjVmQzVOd3hfVG9rZW46Ym94Y24wVlY2ZFhFV2VXSTBEaVhnMVJzdE9jXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

```SQL
explain select * from tb_user where profession = '软件工程' and age = 31;
```

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=NWRlN2E2ZmI1MTkyYTFjZTVjMWI1MDQxMTRjYzE2NGVfS24zTjFBTGtiWVVPMldFNXBCUkFCaEFzMmI5a2dFQkZfVG9rZW46Ym94Y253MFVkRWgwNE5UY3Y3OFRhR29CTDZnXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

```SQL
explain select * from tb_user where profession = '软件工程' and age = 31;
```

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=NGExMjkwZjFiOThlZTI5N2JmNjNhOTIyZjRhMjMzNTBfWGJhUTVEYWg5UGJhZ2gxTTZmdXNYdDczNmJuNTNHTTlfVG9rZW46Ym94Y25PRnpRRVljVzRBN1JMYVdGM0c4a0UxXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

profession key\_len = 47, status key\_len  5， age key\_len 为 2

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=NDM5NTM3YTM1OTVhNjk4MDUzNDBhODVhMjEyMTk1MDNfNk5VS1hoQ1hRZlRucXQwajZMUG5QZ3I1QXhEUk9lTG1fVG9rZW46Ym94Y25PQ0NYUjVJRlZYOThrOFR6V2tEYmZlXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

### 索引失效

* 范围查询

联合索引，出现范围查询右侧索引失效

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=MGFhNjgwYWZlNDJhZmExZjU0OTRmOTg4NWZlNGY3YmRfUDNKMkpKY0p5ZlF3WW9WbWhER1UwekZMS0xXUjhxVUFfVG9rZW46Ym94Y241SmFrVlpVNTZxSVBVU2xoS2NLMEZoXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

* 索引列参与运算

```SQL
create index idx_user_phone on tb_user(phone);
```

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=NjhhZThmYzRlNjA4YzhjMTA4OWJlM2U4M2UyZmRkNGVfVjlyZ1ZuWG5ZR1BOUkI2VjZlTUhVakZIWEdLYTVsYlRfVG9rZW46Ym94Y25CVUFHcG9pM1A3czFoZXl3SVU5OU9mXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=YTg2ZTZkMGM1YTM0OTBiNjdmMzZmZmZlMDZjN2JmYzhfOHRFYUxVMjJpN1JGUElEOVhEMmlVMWQ2TVp6ckdMN0xfVG9rZW46Ym94Y256SWhGQVJIQXdqeU9TeERLYTBIM3hiXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

* 模糊查询，头部模糊匹配

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=YjBhMDkzY2E2MzdjZjY0YmMwZmVlMmY0YTQ4OTc3YWZfMm5uRGg5eDlqWnRpVWlEYXJKU3RlWU9JRTNiMjBZM2FfVG9rZW46Ym94Y255ZDNrYVhwclNtbUpsU3B0Tjd0SFhxXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

* or 连接条件

or 左右两侧都有索引时，索引才生效

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=MDk5ZmFhNGVmZDFjYzNkM2ZhODY3ZjNhYmQ1NWRhMzhfbEZDZzBQU1VXWlU3b0NJb21wN2hyZXJ4ZXZjM1A0QnZfVG9rZW46Ym94Y25PbTlENGczV0x4VVMydlcxSlBBa2hlXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

* 数据分布影响

mysql 评估使用索引比全表慢则不使用索引

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=ZTNkYTI0MTc3ZjhiMzQ4ODIzMmNkODM2M2I3ZDA1NDNfTGZZVGgzd01ibXZpUjM2MXh0S1hBUVZsTXN4OVhOTzlfVG9rZW46Ym94Y25ROW1OWkRCY21EbjhyS0UxVVExTUplXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=NWZhNmVjOTI1YjYxNTEwMTIxOTUyMzkzMmIxZTFkZmJfR0tObWlWU2Z6WkxmM3RHaEFzTlI3ZVc0bFZCY3l6eGJfVG9rZW46Ym94Y25MY0h6Q1U3MEdJanJ3bTAxcG9FYlRmXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

### SQL 提示

如果既创建了联合索引又创建了单列索引，可以通过 SQL 提示建议或强制 mysql 使用某一索引查询数据

* use index
* ignore index
* force index

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=NjllZTcwMTljMjQ3MmZlYTc3ODNiNDI1YTFiYWIyMTlfVW5TYnV4UmNRVFJFTHRIUWxtUzVVamxPQjJnT2dYRjdfVG9rZW46Ym94Y24xdUk2a1IzWkVXRElkTTNxdDc4RDBjXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

### 覆盖索引

当 select 返回的字段 全在索引中包含后，避免了回表查询，可以提高查询效率

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=OTI5YTFjOWJlMWU0NzJjYzhjZWRkODg3MmY4YTI2MmNfakd2N0RVNFB6dXAzbzZDZ0Z6TjRnQ21YM0lYelRGbUJfVG9rZW46Ym94Y251YUhONUlxMTRMUjFaa1BIQmhCSXllXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=NDJkN2NkMjEzNjkzZWQyZjFhMGU1ZWE2MTYwMjhhZjlfUTRWMEdwZjRGQ0V3TGZ6WktabThVdEprMzRTcDQ4SDNfVG9rZW46Ym94Y25Kc1JoODkxQ0tMbVN1UlNabzRUMUhiXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=NzIzMTQ3N2JmZDY5MmNlMGIyY2U5MTI2ZTY5NGI0ZThfWE13UGJSaEd0Zm5sVUE2Y1BOZEV0b3loek80VW1uRzZfVG9rZW46Ym94Y25MYVRxbzl4YkhDblNJbWREU0F6YU1mXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=MzM1ZDkxZDc5NDdiNzQzOWExNTNlNmIxZDYyY2ZiMTFfSXBacmpXSVozZ1lzenQ3MEtuMkViY2xTZFlHYXFEb2dfVG9rZW46Ym94Y25HZzliZk02djlXb2lscWlOWEtFdlhmXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

因此尽量避免 select \* 操作

### 前缀索引

对于字符串列（varchar、text、longtext）直接建立索引，索引很大，浪费大量磁盘 IO，影响查询效率。这时候可以截取字符串，取前缀做索引。

```SQL
create index idx_xxxx on table_name(column(n)) ;
```

前缀取多长由选择性来判断，选择性越高越好。

```SQL
select count(distinct email) / count(*) from tb_user; 
select count(distinct substring(email,1,5)) / count(*) from tb_user ;
```

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=ZDZmNjJjODA2Zjk0NWM0YTcxMDQwODllNjE1NjliOGVfa1ZRZGE3TEhyOTI1VkJBam9XSVFtMFlMR25RWmtGR2JfVG9rZW46Ym94Y25MMnN5aWRWUWlyenIwbURsVGlmcWJmXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=OWM2ZDE5MjEzZjc2NDQ5MmVjYmNjOTFiZWU3MmE1YjVfRVNJSDhJV0w2dDJsd3dvazNiUzBGTW91eDQzdHlydkVfVG9rZW46Ym94Y25Pc003bmJUdEVxcVQ4ZUZNRHhYZk5kXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=NzA5NjNmYzJjZWQ3M2VjNTE4MWM5ODg3NDIxNzVjMmNfQnM1WkR5MkU4TFJsbmh0aENKcUFhTXdLeDYybTFjY2ZfVG9rZW46Ym94Y25mdG13V09udUVLSThKVUpicHhUMlBjXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

区分度越高越好，区分度越高，确定的范围越小查询越快

**暂时无法在飞书文档外展示此内容**

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=M2E5MGQwMjFlYzA1ODIxOGRkNzNmMzkzYjM1OWU0NTdfVHd3UkVpdlFMM01mRXNsZm9tb3N1WjhQV0ZhN3hSOGZfVG9rZW46Ym94Y25NU25US3ljbmJkRnVpZHZHS2U3YWxMXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=ODZhNTQzZWQ3ZGU5NWRmOTU0YjM3ZjllM2NjNWM5NTNfZE13bGNKUU80WG5ZNU9OejZoUXppSmRHQ1ZaNG11eENfVG9rZW46Ym94Y25XUncxNDlvblo5SU9kNUtKRllCZVVjXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

### 单列&&联合索引

![](https://my.feishu.cn/space/api/box/stream/download/asynccode/?code=ZmQ4MWNmNTY4MDhjMzhlNjA2MTcyMzg1NWYzYmNmMTVfelNlN1Q3cEhqSzdCZGdxQ2ZUYXJXUnVDcXFmY0RLUjFfVG9rZW46Ym94Y251UkhJUHhwMFJyUVpCV3BLeEFUMTVmXzE3NzM1ODY5MDQ6MTc3MzU5MDUwNF9WNA)

## 索引设计原则

1.数据量大，查询频繁的表需要建立索引

2.针对常常作为查询、排序、分组条件的字段建立索引

3.选择区分度高的字段建立索引

4.尽量使用联合索引、减少单列索引，联合索引可以覆盖索引，避免回表，提高查询效率

6.控制索引数量，索引会影响增删改的效率


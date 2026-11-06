---
title: MySql binlog & debus
categories:
  - MySql
date: 2026-03-15 23:05:33
tags:
---
# binlog

## binlog 的概念

binlog（binary log）是 mysql 的二进制日志。binlog 只记录变更相关的操作信息，如语句的执行时间、时长、操作数据等额外信息。不包括 select、show 操作。

1. 查看 mysql 的变更
2. mysql 数据备份与恢复
3. mysql 的主从复制

## binlog 二进制的格式

### 1.statement 模式

* 概述

记录数据库执行的原生 Sql 语句。

* 优点

不需要记录每一行的变化，日志量相对较小，节省 IO，提高性能，主从复制网络带宽小。

* 缺点
  由于记录的是 SQL 执行语句，为了保证这些语句能在 slave 端执行，必须记录上下文信息来保证 slave 上执行能得到与 master 相同的结果。某些 sql 函数无法使用，比如 sysdate(),会出现**主从数据不一致的问题。**

### 2.row 模式

* 概述

记录一行数据在更改前和更改后的变化。

* 优点

详细的记录了数据的修改情况，主从复制模式下可靠性高。

* 缺点

row 模式下二进制文件最大，占用硬盘空间，网络带宽高，对性能有一定的影响

### 3.mixed 模式

* 概述

statement 模式与 row 模式的结合，更加 sql 判断使用哪种模式，默认采用 statement 模式，特使情况会转换为 row 模式。

* 使用了类似 uuid()、user()、current\_user()等不确定的函数
* 使用了 UDF
* 使用了临时表
* 使用了 insert delay 函数

## binlog 二进制日志的查看

```undefined
show variables like 'binlog_format';
```

![](/images/asynccode_1773587137423.png)

## binlog 日志开启

在 mysql 配置文件中添加 log\_bin 选项开启

```undefined
log_bin=dir/filename
```

* dir 为文件路径，默认放置在数据目录下
* filename 指定 bilog 文件名称
* 形如 mysql-bin.000001

重启 mysql 服务、或执行 `flush logs` 都会产生新的 binlog 日志文件

## 查看 binlog 日志

* 查看启用状态

```undefined
show variables like 'log_bin';
```

![](/images/asynccode_1773587137729.png)

* 查看所有二进制文件列表

```undefined
show binary logs;
```

* 查看当前正在写入的二进制文件

```undefined
show master status;
```

* 查看二进制文件内容

未指定路径时默认在当前目录下查找

```undefined
mysqlbinlog mysql.000001
```

## 删除 binlog 文件

binlog 日志中存储了大量信息，长时间不清理会占用磁盘空间。

### 手工删除

* 删除所有二进制文件

```undefined
reset master;
```

* 根据编号删除二进制文件

删除编号之前的二进制日志

```undefined
purge binary logs to 'xxx';
```

* 根据创建时间删除二进制文件

```undefined
purge binary logs before '2022-06-01 00:00:00';
```

### 自动清理

设置 expire\_logs\_days 参数，表示自动清理。默认值为 0，表示不开启。启用后 mysql 启动或 flush logs 时删除超出当前天数的 binlog

![](/images/asynccode_1773587138075.png)

# dbus

## 流程图

**暂时无法在飞书文档外展示此内容**

## 概念

数据传输中间件，支持数据的全量迁移、增量迁移。源端支持 mysql、mongodb

## 数据拉取原理

增量迁移伪装成 master 的一个 slave，从 mysql 主库拉取 binlog。

* 单线程拉取，放入内存队列
* 单线程转换，加上字段名、字段类型，放入内存队列

全量迁移是从主库或者从库查数据，每次 8192 行，库实例之间并行拉取，表之间串行拉取

## 写入 RMQ

* Tag 为表名
* batch1024 发送消息
* 消息有序
* 消息大小限制是 128m，bach 超过，拆成行发送，行超过 128m 就丢弃，发飞书通知
* 数据过期：增量 2 天、全量 7 天
* mq 无法写入时，dbus 无限重试，直到成功不会丢数据

# 接入方式

## 1.申请 dbus

业务通过 rds/bytedoc 平台申请创建 dbus 链路，支持全量、增量两种模式的链路申请。平台会调用 dbus 的 api，创建 dbus 服务。dbus 的 api 会自动进行 mq topic 创建、任务元信息写入 etcd 以及任务挂载到指定的 dbus worker 上。

![](/images/asynccode_1773587138733.png)

![](/images/asynccode_1773587140291.png)

## 2.mq 消费组申请、读写授权

![](/images/asynccode_1773587141729.png)

![](/images/asynccode_1773587143265.png)

## 3.编码

1.初始化 consumer

```Java
@Slf4j
@Configuration
public class BinlogConsumerConfig {

    @Bean(destroyMethod = "shutdown")
    public DefaultMQConsumer enginBinlogConsumer(BinlogConsumerConfigInfo info, EnginBinlogHandler handler) {
        log.info("engin binlog consumer config info {}, handler {}", info, handler);
        DefaultMQConsumer consumer = new DefaultMQConsumer(info.getCluster(), info.getTopic(), info.getGroup());
        consumer.setConsumeFromWhere(SubscribeRequestV2.ConsumeFromWhere.CONSUME_FROM_LATEST);
        consumer.setSubExpr(info.getTag());
        consumer.registerHandler(handler);
        log.info("engine binlog mq consumer start! cluster:{}, topic:{}, group:{}", info.getCluster(), info.getTopic(), info.getGroup());
        consumer.start();
        return consumer;
    }
}
```

2.倒入 DbusMessage 文件

[dbus mysql 增量消息格式-java 版本](https://bytedance.feishu.cn/docs/doccnwEUxWvzsyeWEPGG69Xz0dg#MrgPbY)

3.编写

```Java
public class EnginBinlogHandler implements MessageHandler {

    @Resource
    private List<AbstractDBusEventHandler> handlers;

    @Override
    public ConsumeStatus handleMessage(ConsumeMessage consumeMessage) {
        return handleMessageBody(consumeMessage);
    }

    private ConsumeStatus handleMessageBody(ConsumeMessage msg) {
        log.info("message from engine {}", msg);
        DbusMessage.Entry entry = null;
        try {
            DbusMessage.Message dbusMessage = DbusMessage.Message.parseFrom(msg.getBody());
            entry = DbusMessage.Entry.parseFrom(dbusMessage.getPayload());
        } catch (InvalidProtocolBufferException e) {
            log.error("[dbus] invalid protocol, messageId:{}", msg.getMsgId());
            return ConsumeStatus.CONSUME_FAILED;
        }
        DbusMessage.EntryBody body = entry.getBody();
        List<DbusMessage.Column> afterImageList = body.getRowdatasList().get(0).getAfterImageList();
        List<DbusMessage.Column> beforeImageList = body.getRowdatasList().get(0).getBeforeImageList();
        Map<String, DbusMessage.Column> beforeImageMap = beforeImageList.stream().collect(Collectors.toMap(DbusMessage.Column::getName, Function.identity()));
        Map<String, DbusMessage.Column> afterImageMap = afterImageList.stream().collect(Collectors.toMap(DbusMessage.Column::getName, Function.identity()));
        DbusMessage.EventType eventType = body.getEventType();
        String tableName = entry.getHeader().getTable();
        log.info("[dbus] recieve msg, messageId:{}, table:{}, method:{}", msg.getMsgId(), tableName, eventType.name());
        // 处理dbus消息
​        ​for (AbstractDBusEventHandler handler : handlers) {
            try {
                handler.handle(tableName, eventType, beforeImageMap, afterImageMap);
            } catch (Exception e) {
                log.error("[dbus] 异常:", e);
                return ConsumeStatus.CONSUME_FAILED;
            }
        }
        return ConsumeStatus.CONSUME_SUCCESS;
    }

}
```


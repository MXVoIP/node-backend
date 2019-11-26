# Reliable Queues - backed by Redis streams
Redis streams intro: <https://redis.io/topics/streams-intro>

# Problem to solve
We fully expect (n) producers and (m) consumers of burstable, variable volumes of messages to ingest. The hurdle here is to ensure each message gets processed at least once. The "handled once and only once" pattern is desired in most cases however it quickly becomes overly complex. Instead we will assume every event gets handled "at least once" with every attempt to make it "only once".

# What we have looked at
- __Apache Kafka__:

	Pros: scalable, stable, great community support, widely used in production

	Cons: JVM tuning, requires zookeper tuning, tuning kafka itself can get complex
- __RabbitMQ__:

	Pros: scalable, stable, great community support, widely used in production

	Cons: tuning can get complex, managing erlang is lesser known and understood
- __Redis - Bull Queue__:

	Pros: stable, simple to setup, fast out of the box

	Cons: complex to scale out, trading some durability for speed, not really designed for microservices out of the box
- __Redis streams__:

	Pros: stable, simple to setup, fast out of the box
	
	Cons: complex to scale out, trading some durability for speed

Ultimately we have chosen redis streams due to ease of setup and ease of modularizing managers, producers and consumers. The barrier to entry is low enough to get pretty far before a more complex solution will be required.

# Modularizing managers, producers, and consumers
## Managers
Responsible for the lifecycle of a queue such as CRUD operations and basic monitoring.

## Producers
Responsible for the ingestion of messages into the queue.

## Consumers
Responsible for processing of messages delivered from the queue. Messages MUST be `ACK`'ed when completed.
Consumers are also responsible for `claim`ing messages that are taking too long from failed or hung processes.
Evey `claim`ed message generates an alert.

# Requirements
## Manager interface
- it should provide CRUD operations on queues
  - it should provide `XINFO` data on queues (`streams`)
- it should provide CRUD operations on consumer groups
  - it should provide `XINFO` data on consumer groups
- it should provide basic health status of the system
  - it should allow configuration of ok/warn/alert thresholds
    - number of active consumers on a queue
    - number of undelivered messages in queue
## Producer interface
- it should fail if unable
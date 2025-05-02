---
tags:
  - "#❓"
time: "02-05-2025 09:33"
source:
---

Есть 2 виртуальные машины с белым ip адресом.
- MasterNode - главная машина, которая не может упасть, но на ней могу упасть отдельные сервера
- WorkerNode - второстепенная машина, которая может упасть полностью

(Node - это отдельный сервер. В нашем случае это vds)
#### MasterNode


Не может упасть полностью.
Содержит внутри себя  
- MasterNodeController
- Database
- Router

Может содержать внутри себя несколько
- WebSocketServer


#### WorkerNode

Может упасть полностью

Содержит внутри себя 
- несколько WebSocketServer


#### Компоненты

##### MasterNodeController
Через webSocket имеет связь со всеми серверами в кластере.
Осуществляет доразвёртывание webSocketServer
Перезапускает остальные сервера в случае их поломки
##### Database

Структура
- Таблицы
	- **StartConfiguration** - хранит все серверы на старте работы кластера
		- id
		- nodeId - внешний ключ на таблицу startNodes
		- port
		- type - один из
			- Router
			- WebSocketServer
	- **CurrentConfiguration** - хранит все серверы во время работы кластера
		- id
		- nodeId - внешний ключ на таблицу currentNodes
		- port
		- type - один из
			- Router
			- WebSocketServer
	- **StartNodes** - хранит в себе ip адреса всех node на старте
		- id 
		- ip
		- WebSocketServerCreationPriority
			- WebSocketServer создаётся на node с наибольшим приоритетом
			- Если 2 node имеют одинаковый приоритет, то webSocketServer создаётся на случайной node
		- isActive 
			- Если false то считать, что всё что находится на этой node упало
	- **CurrentNodes** - хранит в себе ip адреса и состояние всех node во время работы
		- id 
		- ip
		- WebSocketServerCreationPriority
			- WebSocketServer создаётся на node с наибольшим приоритетом
			- Если 2 node имеют одинаковый приоритет, то webSocketServer создаётся на случайной node
		- isActive 
			- Если false то считать, что всё что находится на этой node упало
	- **StartGeneralConfig** таблица которая хранит пары ключ значение. На старте работы программы
		- Колонки
			- id
			- key 
			- value
		- Пары ключ значение
			- DesiredWebSocketServerAmount - любое целое число от 1 и больше. Обозначает количество webSocketServer, которое нужно иметь. 
	- **CurrentGeneralConfig** таблица которая хранит пары ключ значение. Во время работы программы
		- Колонки
			- id
			- key 
			- value
		- Пары ключ значение
			- DesiredWebSocketServerAmount - любое целое число от 1 и больше. Обозначает количество webSocketServer, которое нужно иметь. 
	- **Room**
		- id
		- deployed_id
			- Может быть null
			- Содержит внешний ключ на CurrentConfiguration таблицу, на строку с webSocketServer на которой эта комната развёрнута
	- **Message**
		- id
		- room_id
			- Внешний ключ на Room таблицу, на строку с комнатой, в которой это сообщение написано
		- text


##### Router

##### WebSocketServer




#### Алгоритмы действий

##### Вход client на главную страницу
- Client посылает http запрос на router о том что хочет получить главную страницу
- Router возвращает статичную главную страницу с javascript кодом
- Client посылает запрос на создание webSocket соединения
- Router принимает запрос и создаёт соединение
- Router делает запрос в Database и получает все комнаты
- Router возвращает через webSocket соединение все комнаты в виде json
- Client с помощью javascript отрисовывает эти комнаты
- Client продолжает следить за обновлением в состоянии комнат через WebSocket соединение


##### Создание комнаты
- Client посылает webSocket запрос на Router что хочет создать комнату
- Router делает запрос в Database и создаёт в ней комнату
- Router отправляет всем Client присоединённым к нему информацию о новой комнате через webSocket в виде json 
- Все подключенные Client добавляют себе на страницу эту комнату

##### Подключение к пустой комнате
- Client делает http запрос на router о том что хочет перейти в комнату
- Router возвращает ему статичную страницу html с этой комнатой
- Client делает http запрос на router о том что хочет подключиться к чату с этой комнатой с таким то id. 
- Router делает запрос в базу данных с целью получить информацию о комнате с таким id и получает ответ что комнаты с таким id нет ни на одном webSocketServer 
- Router делает запрос в базу данных с целью получить список всех работающих webSocketServer.
- Router выбирает случайный webSocketServer и возвращает его ip адрес и порт клиенту. WebSocketServer должен быть доступен из интернета.
- Client делает webSocket запрос на создание соединения с полученным WebSocketServer. В этом запросе он указывает id комнаты.
- WebSocketServer получает запрос на webSocket соединение и делает его.
- WebSocketServer видит, что у него нет комнаты с таким id поэтому он её создаёт
- WebSocketServer отправляет в базу данных сообщение, о том что он развернул у себя комнату с таким то id 

##### Подключение к комнате с людьми
- Client делает http запрос на router о том что хочет перейти в комнату
- Router возвращает ему статичную страницу html с этой комнатой
- Client делает http запрос на router о том что хочет подключиться к чату с этой комнатой с таким то id. 
- Router делает запрос в базу данных с целью получить информацию о комнате с таким id и получает ответ что комната с таким id есть на таком то webSocketServer
- Router возвращает ip адрес и порт этого webSocketServer клиенту. WebSocketServer должен быть доступен из интернета.
- Client делает webSocket запрос на создание соединения с полученным WebSocketServer. В этом запросе он указывает id комнаты.
- WebSocketServer получает запрос на webSocket соединение и делает его.
- WebSocketServer видит, что у него есть комната с таким id и подключает клиента к этой комнате.

##### Отправка сообщений
- Client делает webSocket запрос на WebSocketServer с текстом сообщения
- WebSocketServer отправляет запрос в Database с целью добавить это сообщение
- WebSocketServer отправляет всем Client подключённым к комнате текст сообщения
- Все Client отображают этот текст у себя на экране 

##### Отключение от комнаты если ты не последний
- Client каким либо образом закрывает страницу
- WebSocketServer видит, что webSocket соединение обрывается и удаляет этого клиента из комнаты

- Если это был последний клиент в комнате, то webSocketServer делает запрос в базу данных, что сворачивает эту комнату
- WebSocketServer сворачивает эту комнату

##### Удаление пустой комнаты 
- Клиент отправляет webSocket запрос, на Router о том что хочет удалить комнату с таким то id
- Router делает запрос в Database и смотрит на каком сервере развёрнута комната
- Router получает ответ от Database, что комната не развёрнута
- Router делает запрос в базу данных и удаляет комнату
- Router посылает по webSocket информацию всем подключенным клиентам, что комната была удалена

##### Удаление комнаты с людьми 
- Клиент отправляет webSocket запрос, на Router о том что хочет удалить комнату с таким то id
- Router делает запрос в Database и смотрит на каком сервере развёрнута комната
- Router получает ответ от Database, что комната развёрнута
- Router через webSocket запрос возвращает клиенту сообщение о том что комната не может быть удалена, так как в ней есть люди

#### Работа с кластером


##### Развёртывание
###### Что нужно иметь на старте
- docker установленный на всех узлах
- В базе данных должен храниться файл конфигурации
- В dockerhub должны быть все необходимые image для наших серверов, чтобы их можно было подтянуть в момент запуска

###### Процесс развёртывания
- Запусти Database
- Запусти MasterNodeController, в аргументах укажи адрес и порт базы данных
- MasterNodeController запускает свою панель управления на некотором порту ( например 7878)
- Программист нажимает на панели управления на кнопку запустить кластер 
- MasterNodeController делает запрос в Database и получает адрес и порт всех серверов
	- MasterNodeController создаёт соединение с Database и не разрывает его. 
	- Если соединение разрывается, и его не получается восстановить, то считается что Database упала.
- MasterNodeController запускает router, в аргументах указывает адрес и порт базы данных
	- MasterNodeController устанавливает webSocket соединение с router
	- Если соединение разрывается и его не получается восстановить, то считается что router упал.
- MasterNodeController запускает один за другим WebSocketServer, каждому из них указывает 
	- MasterNodeController устанавливает webSocket соединение с каждым из WebSocketServer
	- Если соединение разрывается и его не получается восстановить, то считается что router упал.

Первые два пункта из этого плана можно оформить в bash скрипт, чтобы не писать из руками.


##### Восстановление при сбое Router
- MasterNodeController получает сообщение о том что webSocket соединение с router разорвано
- MasterNodeController делает запрос в базу данных, об актуальном адресе и порте router.
- MasterNodeController пытается подключиться к router через webSocket по полученному адресу
- У MasterNodeController не получается это сделать. 
- MasterNodeController считает что router упал
- MasterNodeController отправляет через ssh, команду о развёртывании актуального адреса и порта для Router. 
	- В аргументах к запуску Router указывается актуальный адрес и порт базы данных
- MasterNodeController с некоторым интервалом посылает запросы о том что хочет установить webSocket соединение с Router
- MasterNodeController устанавливает webSocket соединение с Router
	- В случае если после 5 запросов соединение не установлено, то MasterNodeController роняет весь кластер.



##### Восстановление при сбое Database
- MasterNodeController получает сообщение о том что соединение с Database разорвано
- MasterNodeController пытается подключиться к Database снова
- У MasterNodeController не получается это сделать. 
- MasterNodeController считает что Database упал
- MasterNodeController отправляет через ssh, команду перезапуске Database.
- MasterNodeController с некоторым интервалом посылает запросы о том что хочет установить webSocket соединение с Database
- MasterNodeController устанавливает соединение с Database
	- В случае если после 5 запросов соединение не установлено, то MasterNodeController роняет весь кластер.

##### Восстановление при сбое webSocketServer при работающем node 
- MasterNodeController получает сообщение о том что соединение с webSocketServer разорвано
- MasterNodeController пытается подключиться к webSocketServer снова
- У MasterNodeController не получается это сделать. 
- MasterNodeController считает что webSocketServer упал
- MasterNodeController отправляет через ssh, команду перезапуске webSocketServer.
- MasterNodeController с некоторым интервалом посылает запросы о том что хочет установить webSocket соединение с webSocketServer
- MasterNodeController устанавливает соединение с webSocketServer
	- В случае если после 5 запросов соединение не установлено, то MasterNodeController роняет весь кластер.


- В это время клиент долбится каждые 5 секунд в router, пока router не решит проблему клиента и не подключит его к комнате.

##### Восстановление при сбое webSocketServer при неработающем node 
- MasterNodeController получает сообщение о том что соединение с webSocketServer разорвано
- MasterNodeController пытается подключиться к webSocketServer снова
- У MasterNodeController не получается это сделать. 
- MasterNodeController считает что webSocketServer упал
- MasterNodeController отправляет через ssh, команду перезапуске webSocketServer.
- У MasterNodeController не получается связаться с node через ssh
- MasterNodeController понимает, что node упал
- MasterNodeController делает пометку в бд о том что node упал
- MasterNodeController удаляет все остальные webSocketServer на этом node из бд и ссылки на них в room  таблице
- MasterNodeController разворачивает дополнительные контейнеры webSocketServer
- MasterNodeController добавляет ip адреса и порты новых серверов в базу данных


- В это время клиент долбится каждые 5 секунд в router, пока router не решит проблему клиента и не подключит его к комнате.


##### Увеличить число webSocketServer
- Программист меняет в таблице CurrentGeneralConfig, строку DesiredWebSocketServerAmount на большее число через admin панель
- MasterNodeController смотрит в таблицу CurrentNodes, чтобы по приоритету понять на каком кластере создавать новые серверы
- MasterNodeController разворачивает дополнительные контейнеры webSocketServer
- MasterNodeController добавляет ip адреса и порты новых серверов в базу данных

##### Уменьшить число webSocketServer
- Программист меняет в таблице CurrentGeneralConfig, строку DesiredWebSocketServerAmount на меньшее число через admin панель
- MasterNodeController смотрит в таблицу CurrentNodes, чтобы по приоритету понять на каком кластере убирать серверы 
- MasterNodeController останавливает некоторые контейнеры
- MasterNodeController удаляет в room таблице ссылки на эти контейнеры
- MasterNodeController удаляет ip адреса и порты этих контейнеров из базы данных

##### Уронить весь кластер

Если по какой-либо причине нужно остановить весь кластер

- MasterNodeController делает запрос в базу данных и получает все актуальные конфигурации
- MasterNodeController через ssh останавливает все остальные сервера
- Работающими остаются только MasterNodeController и Database


- Миша фронт и router database
- Никита webSocketServer
- Юра masternodecontroller


Фронт
router
websocketserver
masternodecontroller
database - очень просто

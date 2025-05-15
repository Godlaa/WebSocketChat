import {pool} from "./db";
import {Client} from "ssh2";
import {QueryResult} from "pg";
import {monitor} from "./monitoring";

export type GeneralConfig = {
    DesiredWebSocketServerAmount: number,
    PrivateKeyPath: string,
    RouterConfigPath: string,
}

export async function upWebSocketServers(nodes: QueryResult, config: GeneralConfig) {

    for (let i = 0; i < config.DesiredWebSocketServerAmount; i++) {
        const result = await upWebSocketServer(
            nodes.rows[
                Math.floor(Math.random() * nodes.rows.length)
                ],
            config
        )
    }
}

export async function upWebSocketServer(node: any, config: GeneralConfig, port: number | null = null) {
    return new Promise<void>((resolve, reject) => {
        const conn = new Client();

        try {
            conn.on('ready', async () => {


                if (port === null) {
                    port = await getFreePort(conn);
                }


                const connStr = `"postgresql://${pool.options.user}:${pool.options.password}@${pool.options.host}:${pool.options.port}/${pool.options.database}"`;

                const envVars = `-e DB_ADDR=${connStr} -e HOST="${node.ip}" -e PORT="${port}" -e MASTER_URL=""`
                const ports = `-p ${port}:8080`
                const createCommand = `docker run --rm -d ${ports} ${envVars} terik222/websocketchat1-ws-server`

                let containerId = await execCommand(conn, createCommand);
                containerId = containerId.replace(/(\r\n|\n|\r)/g, '');
                console.log(`container id: ${containerId} port: ${port} - WebSocketServer is created `);


                conn.end()

                await pool.query(
                    `insert into "currentConfiguration"("nodeId", port, type, "containerId")
                     values ($1, $2, 'WebSocketServer', $3)`, [node.id, port, containerId]
                )

                resolve()

            })

            conn.connect({
                host: node.ip,
                port: 22,
                username: 'root',
                privateKey: require('fs').readFileSync(config.PrivateKeyPath)
            });
        } catch (err) {
            console.error('Error:', err);
            conn.end();
            reject()
        }
    })
}

export async function upRouter(node: any, config: GeneralConfig, port: number | null = null) {
    return new Promise<void>((resolve, reject) => {
        const conn = new Client();
        try {
            conn.on('ready', async () => {
                if (port === null) {
                    port = await getFreePort(conn);
                }

                const envVar = `-e PGHOST=${pool.options.host} -e PGPORT=${pool.options.port} -e PGDATABASE=${pool.options.database} -e PGUSER=${pool.options.user} -e PGPASSWORD=${pool.options.password} -e PORT="5000"`
                const ports = `-p ${port}:5000`
                const createCommand = `docker run -d --rm ${ports} ${envVar} terik222/websocketchat1-router`


                let containerId = await execCommand(conn, createCommand);

                containerId = containerId.replace(/(\r\n|\n|\r)/g, '');
                console.log(`container id: ${containerId} port: ${port} - Router is created `);

                conn.end()

                await pool.query(
                    `insert into "currentConfiguration"("nodeId", port, type, "containerId")
                     values ($1, $2, 'Router', $3)`, [node.id, port, containerId]
                )

                await updateRouterConfig(config)
                resolve()


            })

            conn.connect({
                host: node.ip,
                port: 22,
                username: 'root',
                privateKey: require('fs').readFileSync(config.PrivateKeyPath)
            });
        } catch (err) {
            console.error('Error:', err);
            conn.end();
            reject(err)
        }
    })


}

export async function upClient(node: any, config: GeneralConfig, port: number | null = null) {
    return new Promise<void>((resolve, reject) => {
        const conn = new Client();

        try {
            conn.on('ready', async () => {

                if (port === null) {
                    port = await getFreePort(conn);
                }

                const volumes = `-v ${config.RouterConfigPath}:/usr/share/nginx/html/config`
                const ports = `-p ${port}:80`
                const createCommand = `docker run -d --rm ${ports} ${volumes} terik222/websocketchat1-client`


                let containerId = await execCommand(conn, createCommand);
                containerId = containerId.replace(/(\r\n|\n|\r)/g, '');

                console.log(`container id: ${containerId} port: ${port} - Client is created `);


                conn.end()

                await pool.query(
                    `insert into "currentConfiguration"("nodeId", port, type, "containerId")
                     values ($1, $2, 'Client', $3)`, [node.id, port, containerId]
                )

                await updateRouterConfig(config)

                resolve()


            })

            conn.connect({
                host: node.ip,
                port: 22,
                username: 'root',
                privateKey: require('fs').readFileSync(config.PrivateKeyPath)
            });
        } catch (err) {
            console.error('Error:', err);
            conn.end();
            reject()
        }
    });
}

export async function downContainer(container: any, config: GeneralConfig) {
    return new Promise<void>((resolve, reject) => {
        const conn = new Client();

        conn.on('ready', async () => {
            try {

                await execCommand(conn, `docker stop ${container.containerId}`);
                console.log(`container id: ${container.containerId} port: ${container.port} - ${container.type} is down `);


                conn.end()

                await pool.query(
                    `delete
                     from "currentConfiguration"
                     where id = $1`,
                    [container.id]
                )

                resolve()

            } catch (err) {
                console.error('Error:', err);
                conn.end();
                reject()
            }
        })

        conn.connect({
            host: container.ip,
            port: 22,
            username: 'root',
            privateKey: require('fs').readFileSync(config.PrivateKeyPath)
        });
    });
}

export function execCommand(conn: Client, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        conn.exec(command, (err, stream) => {
            if (err) return reject(err);

            let stdout: string = '';
            let stderr: string = '';

            stream.on('close', (code: number, signal: any) => {
                if (code === 0) resolve(stdout);
                else reject(new Error(`Command failed with code ${code}: ${stderr}`));
            }).on('data', (data: string) => {
                stdout += data.toString();
            }).stderr.on('data', (data) => {
                stderr += data.toString();
            });
        });
    });
}

async function getFreePort(conn: Client) {
    let freePort = await execCommand(conn, `while :; do PORT=$(shuf -i 32000-45000 -n 1); ! ss -lntu | awk '{print $5}' | grep -q ":$PORT\\$" && echo $PORT && break; done`);
    return parseInt(freePort, 10)
}


async function updateRouterConfig(config: GeneralConfig) {
    return new Promise<void>((resolve, reject) => {

        const f = async () => {
            try {
                const conn = new Client();
                const router = await pool.query(`
                    select *
                    from "currentConfiguration" sc
                             inner join "currentNodes" sn on sc."nodeId" = sn.id
                    where type = 'Router' `
                );

                const client = await pool.query(`
                    select *
                    from "currentConfiguration" sc
                             inner join "currentNodes" sn on sc."nodeId" = sn.id
                    where type = 'Client' `
                );

                if (router.rows.length === 0 || client.rows.length === 0) {
                    resolve()
                    return
                }

                const node = client.rows[0];
                conn.on('ready', async () => {
                    try {
                        const obj = {routerIp: router.rows[0].ip, routerPort: router.rows[0].port};
                        const jsonString = JSON.stringify(obj);

                        let status = await execCommand(conn, `echo '${jsonString}' > ${config.RouterConfigPath}/routerConfig.json`);
                        console.log('Updated router config')
                        resolve()
                    } catch (e) {
                        resolve()
                    }

                })

                conn.connect({
                    host: node.ip,
                    port: 22,
                    username: 'root',
                    privateKey: require('fs').readFileSync(config.PrivateKeyPath)
                });


            } catch (e) {
                resolve()
            }
        }
        f()

    })
}

async function upCluster() {
    console.log('MasterNodeController started')

    await downCluster()

    const nodeMap = await initializeDb()

    const currentNodes = await pool.query(`
        select *
        from "currentNodes" `
    );

    const config = await getGeneralConfig();

    await upRouter(
        currentNodes.rows[
            Math.floor(Math.random() * currentNodes.rows.length)
            ],
        config
    );

    const result = await upClientFromConfig(nodeMap, config);

    if (!result) {
        await upClient(currentNodes.rows[
                Math.floor(Math.random() * currentNodes.rows.length)
                ],
            config)
    }

    await upWebSocketServers(currentNodes, config);

    console.log('cluster is up')
    monitor()
}

async function upClientFromConfig(nodeMap: any, config: GeneralConfig) {
    const startClientConfig = await pool.query(`
        select n.id, c.port
        from "startConfiguration" c
                 inner join "startNodes" n on c."nodeId" = n.id
        where type = 'Client'`
    );
    if (startClientConfig.rows.length === 0) {
        return false
    }
    const currentClientNode = await pool.query(`
        select *
        from "currentNodes"
        where id = $1`, [nodeMap[startClientConfig.rows[0].id]]
    );
    await upClient(currentClientNode.rows[0], config, startClientConfig.rows[0].port)
    return true;
}


async function initializeDb() {
    const startGeneralConfig = await pool.query(`
        select *
        from "startGeneralConfig" `
    );


    const startNodes = await pool.query(`
        select *
        from "startNodes"`
    );

    await pool.query(`
        truncate table "currentNodes", "currentConfiguration", "currentGeneralConfig" cascade
        `
    );

    const nodeMap: any = {}
    for (const node of startNodes.rows) {

        const nodeId = await pool.query(
            `insert into "currentNodes"(ip, "WebSocketServerCreationPriority", "isActive")
             values ($1, 1, true) on conflict do nothing
                 returning id `, [node.ip]
        )
        const oldNodeId: string = node.id
        if (nodeId.rows.length > 0) {
            nodeMap[oldNodeId] = nodeId.rows[0].id
        }

    }

    for (const row of startGeneralConfig.rows) {
        await pool.query(
            `insert into "currentGeneralConfig"(key, value)
             values ($1, $2)`, [row.key, row.value]
        )
    }


    return nodeMap;
}

export async function getGeneralConfig(): Promise<GeneralConfig> {
    let generalConfig = await pool.query(`
        select *
        from "currentGeneralConfig" `
    );

    if (generalConfig.rows.length === 0) {
        generalConfig = await pool.query(`
            select *
            from "startGeneralConfig" `
        );
    }

    return {
        'DesiredWebSocketServerAmount': generalConfig.rows.find(obj => obj.key === 'DesiredWebSocketServerAmount').value,
        'PrivateKeyPath': generalConfig.rows.find(obj => obj.key === 'PrivateKeyPath').value,
        'RouterConfigPath': generalConfig.rows.find(obj => obj.key === 'RouterConfigPath').value,
    }


}


async function downCluster() {

    const containers = await pool.query(`
        select sc.id, sc."containerId", sc.port, sn.ip, sc.type
        from "currentConfiguration" sc
                 inner join "currentNodes" sn on sc."nodeId" = sn.id `
    );

    const config = await getGeneralConfig();


    const promises = []
    for (const container of containers.rows) {
        promises.push(downContainer(container, config))
    }

    await Promise.all(promises)
}


upCluster()
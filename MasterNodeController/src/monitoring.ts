import {pool} from "./db";
import {Client} from "ssh2";
import {QueryResult} from "pg";
import {getGeneralConfig, GeneralConfig, execCommand, upRouter, upClient, upWebSocketServer} from "./index";

export function monitor() {
    return setInterval(checkAll, 10000);
}

async function checkAll() {
    console.log('healthCheckStarted')
    const config = await getGeneralConfig();
    await checkNodes(config)
    await checkContainers(config)

    await createContainers(config)
}

async function checkNodes(config: GeneralConfig) {
    console.log('node checking started')
    const currentNodes = await pool.query(`
        select *
        from "currentNodes"
        where "isActive" = true`
    );

    for (const node of currentNodes.rows) {
        const result = await checkNode(node, config)
        if (!result) {
            console.log(`${node.ip} checked and found not working`)
            await deactivateNode(node, config);
        }
    }
}

async function deactivateNode(node: any, config: GeneralConfig) {
    await pool.query(`update "currentNodes"
                      set "isActive" = false
                      where id = $1`, [node.id])

    const containers = await pool.query(`select *
                                         from "currentConfiguration"
                                         where "nodeId" = $1`, [node.id])

    for (const container of containers.rows) {
        await removeContainerFromDb(container)
    }
}


async function checkNode(node: any, config: GeneralConfig) {
    const conn = new Client();

    return new Promise<boolean>((resolve, reject) => {
        try {
            conn.on('ready', async () => {
                console.log(`node is working ${node.ip}`)
                resolve(true)
                return
            })
            conn.on('error', (err) => {
                console.error(`Connection error on node ${node.ip}:`, err.message);
                conn.end();
                resolve(false);  // or reject(err) if you want to propagate the error
            });
            console.log(`connecting to node ${node.ip}`)
            conn.connect({
                host: node.ip,
                port: 22,
                username: 'root',
                privateKey: require('fs').readFileSync(config.PrivateKeyPath)
            });
        } catch (e) {
            console.log(`checkNode: ${e}`)
            conn.end();
            resolve(false)
            return;
        }

    })
}


async function checkContainers(config: GeneralConfig) {
    console.log('container checking started')
    const containers = await pool.query(`
        select *
        from "currentConfiguration" cc
                 inner join "currentNodes" cn on cc."nodeId" = cn.id
        where "isActive" = true`
    )
    for (const container of containers.rows) {
        const result = await checkContainer(container, config)
        if (!result) {
            console.log(`${container.id} ${container.type} checked and found not working`)
            await removeContainerFromDb(container)
        }
    }
}

async function checkContainer(container: any, config: GeneralConfig) {
    return new Promise<boolean>((resolve, reject) => {
        const conn = new Client();
        try {
            conn.on('ready', async () => {
                try {
                    const result = await execCommand(conn, 'docker ps -q --no-trunc');

                    const regex = new RegExp(`\\b${container.containerId}\\b`);
                    const match = regex.test(result)

                    resolve(match)
                    return

                } catch (err) {
                    console.error('checkContainer: ', err);
                    conn.end();
                    resolve(false)
                    return
                }
            })
            conn.on('error', (err) => {
                console.error('checkContainer: ', err);
                conn.end();
                resolve(false)
                return
            });
            conn.connect({
                host: container.ip,
                port: 22,
                username: 'root',
                privateKey: require('fs').readFileSync(config.PrivateKeyPath)
            });
        } catch (err) {
            console.error('checkContainer: ', err);
            conn.end();
            resolve(false)
            return
        }
    });
}

async function removeContainerFromDb(container: any) {

    await pool.query(
        `delete
         from "currentConfiguration"
         where "containerId" = $1`,
        [container.containerId]
    )
}


async function createContainers(config: GeneralConfig) {
    createRouter(config)

    createClient(config)

    createWebSocketServers(config)

}

async function createRouter(config: GeneralConfig) {
    const router = await pool.query(`
        select *
        from "currentConfiguration" cc
                 inner join "currentNodes" cn on cc."nodeId" = cn.id
        where "isActive" = true
          and type = 'Router'`
    )
    const currentNodes = await pool.query(`
        select *
        from "currentNodes"
        where "isActive" = true`
    );
    if (router.rows.length === 0) {
        await upRouter(currentNodes.rows[
            Math.floor(Math.random() * currentNodes.rows.length)
            ], config)
    }
}

async function createClient(config: GeneralConfig) {
    const client = await pool.query(`
        select *
        from "currentConfiguration" cc
                 inner join "currentNodes" cn on cc."nodeId" = cn.id
        where "isActive" = true
          and type = 'Client'`
    )
    const currentNodes = await pool.query(`
        select *
        from "currentNodes"
        where "isActive" = true`
    );

    if (client.rows.length === 0) {
        await upClient(currentNodes.rows[
            Math.floor(Math.random() * currentNodes.rows.length)
            ], config)
    }
}


async function createWebSocketServers(config: GeneralConfig) {
    const webSocketServers = await pool.query(`
        select *
        from "currentConfiguration" cc
                 inner join "currentNodes" cn on cc."nodeId" = cn.id
        where "isActive" = true
          and type = 'WebSocketServer'`
    )

    const currentNodes = await pool.query(`
        select *
        from "currentNodes"
        where "isActive" = true`
    );

    const amount = config.DesiredWebSocketServerAmount - webSocketServers.rows.length

    for (let i = 0; i < amount; i++) {
        await upWebSocketServer(currentNodes.rows[
            Math.floor(Math.random() * currentNodes.rows.length)
            ], config)
    }

}
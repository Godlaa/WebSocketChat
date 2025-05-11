import {pool} from "./db";
import {Client} from "ssh2";
import {QueryResult} from "pg";

type GeneralConfig = {
    DesiredWebSocketServerAmount: number,
    PrivateKeyPath: string,
}

const f = async () => {
    const webSocketServers = await pool.query(`
        select *
        from "startConfiguration" sc
                 inner join "startNodes" sn on sc."nodeId" = sn.id
        where type = 'WebSocketServer'`
    );

    const router = await pool.query(`
        select *
        from "startConfiguration" sc
                 inner join "startNodes" sn on sc."nodeId" = sn.id
        where type = 'Router' limit 1`
    );
    const nodes = await pool.query(`
        select *
        from "startNodes" `
    );


    // await upRouter(nodes.rows[0], null);

    // const currentRouter = await pool.query(`
    //     select *
    //     from "currentConfiguration"
    //     where type = 'Router'`
    // );

    // await downRouter(nodes.rows[0], currentRouter.rows[0]);

    // await upWebSocketServer(nodes.rows[0], 6666);


    // const currentWebSocketServer = await pool.query(`
    //     select *
    //     from "currentConfiguration"
    //     where type = 'WebSocketServer'`
    // );
    //
    // await downWebSocketServer(nodes.rows[0], currentWebSocketServer.rows[0])
}

// f()
async function upWebSocketServers(nodes: QueryResult, config: GeneralConfig) {

    for (let i = 0; i < config.DesiredWebSocketServerAmount; i++) {
        const result = await upWebSocketServer(
            nodes.rows[
                Math.floor(Math.random() * nodes.rows.length)
                ],
            config
        )
    }
}

async function upWebSocketServer(node: any, config: GeneralConfig, port: number | null = null){
    const conn = new Client();

    conn.on('ready', async () => {
        try {
            const connStr = `"postgresql://${pool.options.user}:${pool.options.password}@${pool.options.host}:${pool.options.port}/${pool.options.database}"`;

            const envVars = `-e DB_ADDR=${connStr} -e HOST="0.0.0.0" -e PORT="8080" -e MASTER_URL=""`
            const ports = `-p 8080`
            const createCommand = `docker run --rm -d ${ports} ${envVars} terik222/websocketchat1-ws-server`

            let containerId = await execCommand(conn, createCommand);


            containerId = containerId.replace(/(\r\n|\n|\r)/g, '');
            console.log(`WebSocketServer is created ${containerId}:`);


            const getPortCommand = `docker port ${containerId} 8080`

            let containerPort = await execCommand(conn, getPortCommand);
            const match = containerPort.match(/:(\d+)/);
            containerPort =  match ? match[1]:'';

            console.log(`WebSocketServer ${containerId} is created on port: ${containerPort}`);

            await execCommand(conn, `ufw allow ${containerPort}`);
            console.log(`port opened with ufw ${containerPort}`)

            conn.end()

            await pool.query(
                `insert into "currentConfiguration"("nodeId", port, type, "containerId")
                         values ($1, $2, 'WebSocketServer', $3)`, [node.id, containerPort, containerId]
            )


        } catch (err) {
            console.error('Error:', err);
            conn.end();
        }
    })

    conn.connect({
        host: node.ip,
        port: 22,
        username: 'root',
        privateKey: require('fs').readFileSync(config.PrivateKeyPath)
    });
}

async function upRouter(node: any, config: GeneralConfig, port: number | null = null){
    const conn = new Client();

    conn.on('ready', async () => {
        try {
            const envVar = `-e PGHOST=${pool.options.host} -e PGPORT=${pool.options.port} -e PGDATABASE=${pool.options.database} -e PGUSER=${pool.options.user} -e PGPASSWORD=${pool.options.password} -e PORT="5000"`
            const ports = `-p 5000`
            const createCommand = `docker run -d --rm ${ports} ${envVar} terik222/websocketchat1-router`


            let containerId = await execCommand(conn, createCommand);

            containerId = containerId.replace(/(\r\n|\n|\r)/g, '');
            console.log(`Router is created ${containerId}:`);


            let containerPort = await execCommand(conn, `docker port ${containerId} 5000`);
            const match = containerPort.match(/:(\d+)/);
            containerPort =  match ? match[1]:'';

            console.log(`Router ${containerId} is created on port: ${containerPort}`);

            await execCommand(conn, `ufw allow ${containerPort}`);
            console.log(`port opened with ufw ${containerPort}`)

            conn.end()

            await pool.query(
                `insert into "currentConfiguration"("nodeId", port, type, "containerId")
                 values ($1, $2, 'Router', $3)`, [node.id, containerPort, containerId]
            )


        } catch (err) {
            console.error('Error:', err);
            conn.end();
        }
    })

    conn.connect({
        host: node.ip,
        port: 22,
        username: 'root',
        privateKey: require('fs').readFileSync(config.PrivateKeyPath)
    });
}

async function downContainer(container:any, config:GeneralConfig){
    const conn = new Client();

    conn.on('ready', async () => {
        try {

            await execCommand(conn, `docker stop ${container.containerId}`);
            console.log(`Container is down ${container.containerId}`)

            await execCommand(conn, `ufw reject ${container.port}`);
            console.log(`port closed with ufw ${container.port}`)

            conn.end()

            await pool.query(
                `delete
                         from "currentConfiguration"
                         where id = $1`,
                [container.id]
            )


        } catch (err) {
            console.error('Error:', err);
            conn.end();
        }
    })

    conn.connect({
        host: container.ip,
        port: 22,
        username: 'root',
        privateKey: require('fs').readFileSync(config.PrivateKeyPath)
    });
}

function execCommand(conn:Client, command:string):Promise<string> {
    return new Promise((resolve, reject) => {
        conn.exec(command, (err, stream) => {
            if (err) return reject(err);

            let stdout:string = '';
            let stderr:string = '';

            stream.on('close', (code:number, signal:any) => {
                if (code === 0) resolve(stdout);
                else reject(new Error(`Command failed with code ${code}: ${stderr}`));
            }).on('data', (data:string) => {
                stdout += data.toString();
            }).stderr.on('data', (data) => {
                stderr += data.toString();
            });
        });
    });
}



async function upCluster() {
    await downCluster();
    console.log('0000000000')

    await initializeDb()

    console.log('1111111')
    const currentNodes = await pool.query(`
        select *
        from "currentNodes" `
    );

    console.log('2222222')
    const config = await getGeneralConfig();

    console.log('3333333')
    await upRouter(
        currentNodes.rows[
            Math.floor(Math.random() * currentNodes.rows.length)
            ],
        config
    );

    console.log('444444', config)
    await upWebSocketServers(currentNodes, config);

}



async function initializeDb() {
    const startNodes = await pool.query(`
        select *
        from "startNodes" `
    );

    const startGeneralConfig = await pool.query(`
        select *
        from "startGeneralConfig" `
    );

    await pool.query(`
        truncate table "currentNodes", "currentConfiguration", "currentGeneralConfig" cascade
        `
    );

    for (const node of startNodes.rows) {
        await pool.query(
            `insert into "currentNodes"(ip, "WebSocketServerCreationPriority", "isActive")
             values ($1, 1, true)`, [node.ip]
        )
    }

    for (const row of startGeneralConfig.rows) {
        await pool.query(
            `insert into "currentGeneralConfig"(key, value)
             values ($1, $2)`, [row.key, row.value]
        )
    }

}



async function getGeneralConfig(): Promise<GeneralConfig> {
    const currentGeneralConfig = await pool.query(`
        select *
        from "currentGeneralConfig" `
    );

    const config = {
        'DesiredWebSocketServerAmount': currentGeneralConfig.rows.find(obj => obj.key === 'DesiredWebSocketServerAmount').value,
        'PrivateKeyPath': currentGeneralConfig.rows.find(obj => obj.key === 'PrivateKeyPath').value,
    }
    return config
}


async function downCluster(){
    const containers = await pool.query(`
        select *
        from "currentConfiguration" sc
                 inner join "currentNodes" sn on sc."nodeId" = sn.id `
    );

    const config = await getGeneralConfig();

    for (const container of containers.rows) {
        await downContainer(container, config)
    }
}



// downCluster()

console.log('container started')
upCluster()
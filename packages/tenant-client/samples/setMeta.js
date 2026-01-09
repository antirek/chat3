const {Chat3Client} = require('../src/Chat3Client');

const baseURL = 'https://tubo-mms3-tenant-api.services.mobilon.ru'  // Без /api, префикс добавляется автоматически
const apiKey = 'chat3_de2b79b6159abaf8cb1145ec95b8136146483d1d34770236014932e13a327f33';

const main = async () => {
    const client = new Chat3Client({
        baseURL, 
        apiKey,
        debug: true,
    })


    await client.setMeta('message', 'msg_5hd1oa9ymv65yt0hw1lz', 'test', 'test2');
}

(main)();
import iMessage from "./imessage.js";
import Discord from "./discord.js";
import config from "./config.js";

let imessage
let discord
const forward = async (message, from) => {
    try {
        if (from === 'discord') {
            await imessage.send(message.text, message.author, message.attachments);
        } else if (from === 'imessage') {
            await discord.send(message.text.replaceAll('￼', ''), message.author || config.iMsg.name, message.attachments);
        }
    } catch (e) {
        console.error('Error while forwarding', e, 'Message:', message, 'From:', from);
    }
}
imessage = new iMessage(config.iMsg.ip, config.iMsg.port, config.iMsg.pass, config.iMsg.useSSL, config.iMsg.channel, async (message) => {
    await forward(message, 'imessage');
});

discord = new Discord(config.discord.token, config.discord.channel, async (message) => {
    await forward(message, 'discord');
});

const promises = [imessage.login(), discord.login()];

Promise.all(promises).then(() => {
    console.log('Logged in!');
    imessage.send('Started!', 'Discord');
    discord.send('Started!', 'iMessage');
}).catch((e) => {
    console.error(e);
});
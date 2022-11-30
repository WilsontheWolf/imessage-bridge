import fetch from 'node-fetch';
import path from 'path';
import WebSocket from 'ws';
import { fetchURL } from './shared.js';

class iMessage {
    constructor(ip, port, pass, ssl, recipient, forwardFunc) {
        this.ip = ip;
        this.port = port;
        this.pass = pass;
        this.ssl = ssl;
        this.recipient = recipient;
        this.forwardFunc = forwardFunc;
    }

    get url() {
        return `http${this.ssl ? 's' : ''}://${this.ip}:${this.port}`;
    }

    get wsURL() {
        return `ws${this.ssl ? 's' : ''}://${this.ip}:${this.port}?auth=${this.pass}`;
    }

    async send(message, subject, attachments) {
        let files = [];
        message = message.replace(/(?:https?:\/\/)?(?:[\w+\.])+\.\w+(?:\S)*/g, '­$&­'); // This wraps (­) (U+00AD SOFT HYPHEN) around links which keeps them in the same message on my machine fixing weird issues.
        if (attachments?.length) {
            await Promise.all(
                attachments.map(async ([url, filename]) => {
                    const buffer = await fetchURL(url);
                    if (!buffer || !buffer.length) return;
                    files.push({
                        name: filename,
                        data: buffer.toString('base64'),
                    });
                })
            ).catch((e) => {
                console.error(e);
            });
        }
        return await fetch(`${this.url}/sendText?auth=${this.pass}`, {
            method: 'POST',
            body: JSON.stringify({
                text: message,
                address: this.recipient,
                subject: subject,
                attachments: files,
            }),
        })
            .then((res) => res.ok ? res.statusText : Promise.reject(res.statusText));
    }

    async login() {
        if (this.ws) return;
        this.ws = new WebSocket(this.wsURL);
        this.ws.on('message', (buffer) => {
            const data = JSON.parse(buffer.toString());
            if (data.action === 'newMessage') {
                data.data.message.forEach((message) => {
                    if (!message.text?.trim() && !message.attachments?.length) return;
                    if (!message.subject && this.recipient === message.chatId)
                        this.forwardFunc({
                            author: message.sender == 1 ? null : message.author,
                            text: message.text.trim(),
                            attachments: message.attachments.map((attachment) => [`${this.url}/attachments?path=${encodeURIComponent(attachment[0])}&type=${encodeURIComponent(attachment[1])}&auth=${this.pass}`, path.basename(attachment[0])]),
                        });
                });
            }
        });


        return new Promise((resolve, reject) => {
            let resolved = false;
            this.ws.on('error', (e) => {
                if (!resolved) reject(e);
                console.error(e)
            });
            this.ws.on('close', async () => {
                this.ws = null;
                if (!resolved) reject();
                console.log('Connection closed');
                await this.login();
            });
            this.ws.on('open', () => {
                resolved = true;
                resolve();
            });
        });

    }
}

export default iMessage;
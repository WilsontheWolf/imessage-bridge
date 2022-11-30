import { Client } from "@projectdysnomia/dysnomia";
import { fetchURL } from "./shared.js";

// Stolen from https://github.com/discordjs/discord.js/blob/main/packages/discord.js/src/util/Util.js#L543
function cleanContent(str, channel) {
    return str.replace(/<(@[!&]?|#)(\d{17,19})>/g, (match, type, id) => {
        switch (type) {
            case '@':
            case '@!': {
                const member = channel.guild?.members.get(id);
                if (member) {
                    return `@${member.nick || member.username}`;
                }

                const user = channel.client.users.get(id);
                return user ? `@${user.username}` : match;
            }
            case '@&': {
                const role = channel.guild.roles.get(id);
                return role ? `@${role.name}` : match;
            }
            case '#': {
                const mentionedChannel = channel.client.getChannel(id);
                return mentionedChannel ? `#${mentionedChannel.name}` : match;
            }
            default: {
                return match;
            }
        }
    })
        .replace(/<(:[\w~]+:)(\d{17,19})>/g, '$1');
}

class Discord {
    constructor(token, channelID, forwardFunc) {
        this.token = token;
        this.channelID = channelID;
        this.forwardFunc = forwardFunc;

        this.client = new Client(token, {
            allowedMentions: {
                users: false,
                roles: false,
                repliedUser: true,
                everyone: false,
            },
            gateway: {
                intents: ["guilds", "guildMessages", "messageContent"],
            },
        });
        this.client.on("messageCreate", (message) => {
            if (message.channel.id === this.channelID) {
                if (message.webhookID) return;
                let content = cleanContent(message.content.trim(), message.channel);
                if (!content && !message.attachments.size) return;
                this.forwardFunc({
                    text: content,
                    author: message.member?.nick || message.author.username,
                    attachments: message.attachments.filter(a => a.size < 10485760) // Server doesn't like big attachments. Screw users with nitro
                        .map((attachment) =>
                            [attachment.url, attachment.filename]
                        ),
                });
            }
        });
    }

    async login() {
        let resp = new Promise((resolve, reject) => {
            this.client.once("ready", resolve);
        });
        await this.client.connect();
        return resp;
    }

    async send(message, author, attachments) {
        // get Webhook
        const webhooks = (await this.client.getChannelWebhooks(this.channelID)).filter((webhook) => webhook.token);
        let webhook;
        if (webhooks.length === 0) {
            webhook = await this.client.createChannelWebhook(this.channelID, {
                name: "iMessage",
            });
        }
        else webhook = webhooks[0];

        if (!webhook?.id) throw new Error("No webhook found");
        let files = [];
        if (attachments?.length) {
            await Promise.all(
                attachments.map(async ([url, filename]) => {
                    const buffer = await fetchURL(url);
                    if (!buffer || !buffer.length) return;
                    files.push({
                        filename,
                        file: buffer,
                    });
                })
            ).catch((e) => {
                console.error(e);
            });
        }
        // send message
        await this.client.executeWebhook(webhook.id, webhook.token, {
            content: message,
            username: author,
            attachments: files,
        });

    }
}

export default Discord;
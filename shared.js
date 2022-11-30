import fetch from "node-fetch";

const fetchURL = async (url) => {
    console.log('Downloading', url);
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    console.log('Downloaded', (buffer.byteLength / 1024 / 1024).toFixed(2), 'MB');

    return Buffer.from(buffer);
}

export {
    fetchURL,
}
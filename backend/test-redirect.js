const axios = require('axios');
async function test() {
    try {
        const response = await axios.get('https://tools-rtify.66shh9.easypanel.host/api/spotify/login', { maxRedirects: 0 });
    } catch (e) {
        if (e.response && e.response.status === 302) {
            console.log("Redirect URL:", e.response.headers.location);
        } else {
            console.log("Error:", e.message);
        }
    }
}
test();

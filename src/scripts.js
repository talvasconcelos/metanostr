import { getBlankEvent, relayPool } from "nostr-tools";

const defaultRelays = new Map([
  ["wss://relay.damus.io", { read: true, write: true }],
  ["wss://nostr-pub.wellorder.net", { read: true, write: true }],
  ["wss://nostr-verified.wellorder.net", { read: true, write: true }],
  ["wss://expensive-relay.fiatjaf.com", { read: true, write: true }],
  ["wss://nostr-relay.wlvs.space", { read: true, write: true }]
]);

const pool = relayPool();
let state = null;

window.addEventListener("load", async () => {
  if (!window.nostr) {
    alert("You need nos2x to use this tool!");
    return;
  }

  const nostr = window.nostr;
  const pubkey = await nostr.getPublicKey();

  await startPool(pubkey);
  console.log(state);
  const form = document.getElementById("form");
  const sendBtn = document.getElementById("send-event");
  sendBtn.addEventListener("click", logKey, false);

  document.getElementById("picture").addEventListener("change", (ev) => {
    let src = ev.target.value;
    let image = document.getElementById("image-display").firstElementChild;
    if (!isImage(src)) {
      image.style.display = "none";
      document.getElementById("image-display").ariaBusy = true;
      return;
    }
    image.style.display = "block";
    document.getElementById("image-display").ariaBusy = false;
    image.src = src;
  });

  async function logKey() {
    const data = Object.fromEntries(new FormData(form));

    const event = getBlankEvent();

    let content = {};
    data.name.length ? (content.name = data.name) : null;
    data.about.length ? (content.about = data.about) : null;
    data.picture.length && isImage(data.picture)
      ? (content.picture = data.picture)
      : null;
    data.nip05.length ? (content.nip05 = data.nip05) : null;

    event.kind = 0;
    event.pubkey = await nostr.getPublicKey();
    event.content = JSON.stringify(content);
    event.created_at = Math.floor(Date.now() / 1000);
    console.log(event);
    try {
      const signed = await nostr.signEvent(event);

      const ev = await pool.publish(signed, (status, url) => {
        if (status === 0) {
          console.log(`publish request sent to ${url}`);
        }
        if (status === 1) {
          console.log(`event published by ${url}`, ev);
        }
      });
      form.reset();
    } catch (error) {
      console.error(error);
    }
  }
});

async function startPool(pubkey) {
  const userRelays = await nostr.getRelays();
  const relays = defaultRelays;
  for (const key in userRelays) {
    relays.set(key, userRelays[key]);
  }
  relays.forEach((policy, url) => {
    pool.addRelay(url, policy);
  });
  console.log(`fetch metadata from ${pubkey}`);
  pool.sub({ cb: populateInputs, filter: { authors: [pubkey], kinds: [0] } });
}

function populateInputs(event, relay) {
  if (state && state.created_at > event.created_at) return;
  state = {
    created_at: event.created_at,
    content: JSON.parse(event.content)
  };
  document.getElementById("name").value = state.content.name || "";
  document.getElementById("nip05").value = state.content.nip05 || "";
  document.getElementById("about").value = state.content.about || "";
  document.getElementById("picture").value = state.content.picture || "";

  if (state.content.picture) {
    let figure = document.getElementById("image-display");
    if (figure.hasChildNodes()) {
      figure.removeChild(figure.firstElementChild);
    }
    let img = document.createElement("img");
    img.src = state.content.picture;
    figure.appendChild(img);
  }
}

function isImage(url) {
  return /\.(jpg|jpeg|png|webp|avif|gif|svg)$/.test(url);
}

/*
{
    "id": <32-bytes sha256 of the the serialized event data>
    "pubkey": <32-bytes hex-encoded public key of the event creator>,
    "created_at": <unix timestamp in seconds>,
    "kind": <integer>,
    "tags": [
      ["e", <32-bytes hex of the id of another event>, <recommended relay URL>],
      ["p", <32-bytes hex of the key>, <recommended relay URL>],
      ... // other kinds of tags may be included later
    ],
    "content": <arbitrary string>,
    "sig": <64-bytes signature of the sha256 hash of the serialized event data, which is the same as the "id" field>
  }
  */

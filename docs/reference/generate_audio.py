"""
generate_audio.py — makes every voice file for Word Lab.

Run once:            python generate_audio.py
Re-running only makes what is missing, so it costs nothing to run twice.

To redo lines whose wording changed, name the kinds you want rebuilt. Only
those files are overwritten; everything else is left alone:

    python generate_audio.py --only cloze
    python generate_audio.py --only ask def

Kinds: word, def, ask, cloze, clue, help, ui

The lines below must stay word-for-word identical to words.js. If you edit one
here, edit it there too, or the child hears something different from what is
printed on screen.
"""

import os
import sys

import requests

API_KEY = "sk_5221aa8b5f4a82cfeb45a379c76c86cac55151368c3f1fae"

VOICES = {
    "narrator": "7wlfJf72PCt9FjPj0Beg",
    "zavi": "aiucylPKeaoMltvJhQ74",
    "zayn": "S7IsvAvEoDfui6GSZK3A",
    "mum": "4bI1CCrU7h0M2Oiyw3MN",
    "villager": "jROt6g8D3v2lGhPczSnH",
}

OUT_DIR = "assets/audio"
MODEL = "eleven_multilingual_v2"

WORDS = [
    {"id":"coin", "t":"COIN", "who":"boy",
     "def":"A little round piece of metal money.",
     "ask":"Look what I got for helping at the market! It is metal, it is round, and it goes clink when I drop it.",
     "cloze":"A king put a lion's head on the very first one ever made. What is that round piece of metal money called?",
     "clue":"Metal. Round. Flat. It goes clink when it lands."},
    {"id":"note", "t":"NOTE", "who":"keeper",
     "def":"Paper money.",
     "ask":"Zavi handed me this today. It is only paper — but I took it, because it stands for her coins.",
     "cloze":"Zavi handed the shopkeeper one piece of paper money. What do we call it?",
     "clue":"It is paper money. It stands for coins that somebody is keeping safe for you."},
    {"id":"shop", "t":"SHOP", "who":"keeper",
     "def":"A place where you go to buy things.",
     "ask":"Zavi came in, put her money on my counter, and walked out with chocolate. Where was she standing?",
     "cloze":"Zavi walked in with her money and walked out with chocolate. What is that place called?",
     "clue":"You walk in, somebody stands behind the counter, you walk out with the thing you wanted."},
    {"id":"shell", "t":"SHELL", "who":"sheller",
     "def":"The little sea shell people once used as money.",
     "ask":"Long before there were coins, people by the sea paid for everything with these little shiny things.",
     "cloze":"In the Maldives, people paid with a small shiny thing from the beach. What was it?",
     "clue":"Small, smooth and shiny. It washes up on the beach. People once paid with them."},
    {"id":"paper", "t":"PAPER", "who":"zavi",
     "def":"Paper is what some money is made of — but paper on its own is not money.",
     "ask":"I drew my own money and the shop said no! But mine is made of exactly the same stuff as Mumma's.",
     "cloze":"The shopkeeper does not want it. He wants the agreement. What is your drawing made of?",
     "clue":"Some money is made of it. But a piece of it on its own buys nothing at all."},
    {"id":"money", "t":"MONEY", "who":"zavi",
     "def":"Something everyone agreed we can use to buy things.",
     "ask":"Mumma says everybody agreed that we can hand this over and get anything in the shop for it.",
     "cloze":"Everybody agreed that it works, and that is why it buys things. What is it?",
     "clue":"Everybody agreed to it. It can be metal, or paper, or a tap on a card."},
    {"id":"deal", "t":"DEAL", "who":"zayn",
     "def":"When two people both say yes to a swap.",
     "ask":"I said I would give you bread. You said you would give me eggs. We both said yes. So it is settled!",
     "cloze":"Two people both said yes to the swap. What is that called?",
     "clue":"Both people said yes. Now it is settled and neither one can change their mind."},
    {"id":"swap", "t":"SWAP", "who":"zayn",
     "def":"To give one thing and get another.",
     "ask":"I gave the fisher my shoes. He gave me his fish. No money went anywhere.",
     "cloze":"Chicken Man tried all morning to give his chickens and get bread instead. What was he trying to do?",
     "clue":"You hand over one thing and you get a different thing back."},
    {"id":"pay", "t":"PAY", "who":"baker",
     "def":"To give money for something.",
     "ask":"The lady put her coins down on my counter and carried the bread home.",
     "cloze":"You give the money and you get the thing. What are you doing?",
     "clue":"You hand over money, and you take the thing home with you."},
    {"id":"sign", "t":"SIGN", "who":"neighbour",
     "def":"To write your name to show you agree.",
     "ask":"They all wrote their names at the bottom of the poster. Every one of them.",
     "cloze":"Everyone put their name on the poster. What did every one of them have to do?",
     "clue":"You write your own name at the bottom to show that you agree to it."},
    {"id":"fake", "t":"FAKE", "who":"zavi",
     "def":"A copy that is not the real thing.",
     "ask":"I bit this coin and it bent! A real one would never bend. Somebody made a copy to trick me.",
     "cloze":"The boy bit the coin to check it. What was he worried it might be?",
     "clue":"Somebody made a copy of the real thing, hoping nobody would notice."},
    {"id":"trade", "t":"TRADE", "who":"fisher",
     "def":"Swapping things with someone.",
     "ask":"All morning: my fish for his rice, his rice for her rope, her rope for a net. Round and round.",
     "cloze":"Shells and coins made it much easier to swap things all day long. What is all that swapping called?",
     "clue":"Swapping things with people, over and over, all day long."},
    {"id":"barter", "t":"BARTER", "who":"zayn",
     "def":"Swapping a thing for a thing, with no money at all.",
     "ask":"I offered the baker my chicken and asked for bread. Not a single coin. Just my chicken for his bread.",
     "cloze":"Swapping a thing for a thing, with no money at all. What is that called?",
     "clue":"A thing for a thing. No coins, no notes, no money anywhere in it."},
    {"id":"trust", "t":"TRUST", "who":"mum",
     "def":"Believing someone will keep their promise.",
     "ask":"Zavi gave the keeper every coin she had. He locked them in his box and gave her one piece of paper. Then she walked home smiling, with no coins at all.",
     "cloze":"You leave your coins with somebody because you believe they will keep them safe. What is that called?",
     "clue":"You leave something precious with somebody, because you believe they will look after it."},
    {"id":"agreed", "t":"AGREED", "who":"mum",
     "def":"Everyone said yes.",
     "ask":"Zavi said yes. Zayn said yes. Mumma said yes. Papa said yes. Not one of them said no.",
     "cloze":"Nobody said yes to your paper. Not me, not Mumma, not the shop. What is the word for when everyone says yes?",
     "clue":"Every single person said yes. That is why the paper works."},
    {"id":"promise", "t":"PROMISE", "who":"mum",
     "def":"Something you said you would do, and you mean it.",
     "ask":"The poster says: this paper is worth one chocolate. All four of them wrote their name on it. And they meant it.",
     "cloze":"The paper says your money is safe, and they really mean it. What is that called?",
     "clue":"You said you would do something, and you really mean to do it."},
]

UI_LINES = {
    "ui-open-stall": "Your stall is open. Who shall we help first?",
    "ui-someone-waiting": "Someone else is waiting.",
    "ui-stall-closed": "Stall closed. Everyone found their word.",
    "ui-tap-to-start": "Tap to open your stall.",
    "ui-help-me": "Help me.",
    "ui-hand-it-over": "Hand it over.",
    "ui-next": "Next.",
    "ui-open-again": "Open again.",
    "ui-word-stall-intro": "This is your word stall. People will come and ask you for a word. You build the word and hand it over.",
    "ui-name-baker": "The baker. Has bread.",
    "ui-name-boy": "The coin boy. Has one coin.",
    "ui-name-fisher": "The fisher. Has fish.",
    "ui-name-keeper": "The shopkeeper. Keeps the shop.",
    "ui-name-mum": "Mumma.",
    "ui-name-neighbour": "The neighbour. Did not sign.",
    "ui-name-sheller": "The shell trader. Has sea shells.",
    "ui-name-zavi": "Zavi.",
    "ui-name-zayn": "Zayn.",
}


def speak(text, voice_id, filename, kind, wanted):
    """Make one MP3. Skip it unless it is missing or its kind was asked for."""
    path = os.path.join(OUT_DIR, filename)
    rebuilding = kind in wanted
    if os.path.exists(path) and not rebuilding:
        print(f"  skip   {filename}")
        return

    response = requests.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
        headers={"xi-api-key": API_KEY, "Content-Type": "application/json"},
        json={
            "text": text,
            "model_id": MODEL,
            "voice_settings": {
                "stability": 0.55,
                "similarity_boost": 0.75,
                "style": 0.35,
                "speed": 0.92,
            },
        },
        timeout=120,
    )

    if response.status_code != 200:
        print(f"  FAILED {filename} — {response.status_code} {response.text[:200]}")
        return

    with open(path, "wb") as audio_file:
        audio_file.write(response.content)
    print(f"  {'redo ' if rebuilding else 'made '}  {filename}")


KINDS = ("word", "def", "ask", "cloze", "clue", "help", "ui")


def wanted_kinds(argv):
    """Read --only from the command line. Nothing named means nothing rebuilt."""
    if "--only" not in argv:
        return set()
    names = set(argv[argv.index("--only") + 1:])
    unknown = names - set(KINDS)
    if not names or unknown:
        raise SystemExit(f"--only takes one or more of: {' '.join(KINDS)}")
    return names


def main():
    wanted = wanted_kinds(sys.argv[1:])
    if wanted:
        print(f"Rebuilding these kinds even if they already exist: {' '.join(sorted(wanted))}\n")
    os.makedirs(OUT_DIR, exist_ok=True)
    narrator = VOICES["narrator"]

    for word in WORDS:
        word_id = word["id"]
        voice_key = word["who"] if word["who"] in {"zavi", "zayn", "mum"} else "villager"
        character = VOICES.get(voice_key, narrator)
        print(f"{word_id}:")
        speak(word["t"], narrator, f"{word_id}.mp3", "word", wanted)
        speak(word["def"], narrator, f"{word_id}_def.mp3", "def", wanted)
        speak(word["ask"], character, f"{word_id}_ask.mp3", "ask", wanted)
        speak(word["cloze"], narrator, f"{word_id}_cloze.mp3", "cloze", wanted)
        speak(word["clue"], narrator, f"{word_id}_clue.mp3", "clue", wanted)
        speak(f"This one is {word['t']}.", narrator, f"{word_id}_help.mp3", "help", wanted)

    print("ui lines:")
    for key, text in UI_LINES.items():
        speak(text, narrator, f"{key}.mp3", "ui", wanted)
    print("\nDone. Files are in", OUT_DIR)


if __name__ == "__main__":
    main()

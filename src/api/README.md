# Pandemonium API

The Pandeonium API is a service to search for and stream YouTube videos as audio.

## Running

Usage:

```bash
$ TODO: Add usage example
```

The configuration file for the API is `config.json` and is self explanatory.

## How it works

The service uses the YouTube API to search for videos (a Google API key is needed for this) and yt-dl to download the audio of videos. The audio content is then streamed to the client.
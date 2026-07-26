# hitchhiking.org

We're a bunch of hitchhiking geeks who love building moneyless FOSS projects that help create real life interaction:

* [hitchwiki](https://hitchwiki.org/), since [2005 or so](https://hitchwiki.org/en/Hitchwiki:About#Background)
* [trashwiki](https://trashwiki.org/), since 2008
* [trustroots](https://trustroots.org/), since 2014
* [nostroots](https://nos.trustroots.org), 2025
* [rideshares.org](https://rideshares.org/), nostr based rideshares application, code at [github.com/kenflannery/rideshares-nostr](https://github.com/kenflannery/rideshares-nostr), since May 2025
* [randomroads.org](https://randomroads.org/), a magazine about independent forms of traveling, not actively maintained since 2015 or so
* [restore bits of digihitch](https://digihitch.hitchwiki.org/)
* https://forum.hitchhiking.org


This is a temporary placeholder page.  We want to do something nice with the hitchhiking.org domain.  [Ideas](https://github.com/Hitchwiki/hitchhiking.org/issues):

- [ai.hitchhiking.org](https://github.com/Hitchwiki/hitchhiking.org/issues/4)

More ideas are [welcome](https://github.com/Hitchwiki/hitchhiking.org/issues/new).

## Development

The browser-side NIP-05 identity rules are covered by Vitest:

```sh
npm install
npm test
```

`index.html` is a generated landing page. Run `python heatmap.py` after changing
the map generation; it refreshes both the page and `assets/heatmap.js`.

## License

This repository is dual-licensed:

- Original content and design: [CC BY-SA 4.0](LICENSE-CONTENT.md)
- Software and source code: [AGPL-3.0-only](LICENSE-SOFTWARE.md)

Third-party assets remain subject to their own licenses and trademark terms.
See [LICENSE](LICENSE) for the scope and exceptions.

# GA4 events (Measurement ID is set in server .env as GA4_MEASUREMENT_ID)

All events go through `window.jdTrack(name, params)`: it does nothing unless GA is loaded, which only happens after the visitor accepts the consent banner. No usernames, emails or free text are sent (only ids/slugs; `search_term` is the one typed value).

| Event | Params | Where |
|---|---|---|
| sign_up / login | method = password / google / github / telegram | server flash, fired on the page after redirect |
| select_content | content_type=game, item_id=slug | hub + home game card click |
| game_start | game_slug | first touch/click/key inside a game (injected by GameAnalytics) |
| post_score | game_slug, score | successful POST to the shared scores API (injected) |
| view_article | article_id, topic | article page load |
| read_complete | article_id, topic, percent_scrolled=75 | article scroll |
| share | method, content_type=article, item_id | share links |
| comment_post | content_type = article / profile | news (ajax) and profile wall |
| follow / unfollow | content_type=profile | server flash |
| profile_publish / profile_draft_save | source = editor / ai_import | server flash |
| ai_import_open | - | AI preview page |
| prompt_generate | provider = chatgpt / claude / gemini / copy | prompt builder buttons |
| search | search_term, search_scope = berita / komunitas | results page |
| outbound_click | link_domain, outbound | external links |
| generate_lead | form = contact | contact form sent |

Mark as Key events in https://analytics.google.com/ -> Admin -> Events: sign_up, login, game_start, post_score, generate_lead, profile_publish, read_complete, follow.

Gap: games are stored HTML that Jadidaring serves at /game/{slug}; hooks are injected there. Games opened elsewhere (legacy client sites at /{slug}/) are not instrumented.

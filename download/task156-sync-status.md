# Task 156 — sanguni.so re-sync status

LIVE (applied + verified on hayaan.co, no deploy needed):
9 price drops: iPhone 18 Pro Max family -$50..-$200 (8 variants), Samsung Galaxy A17 8/256 $263->$240. Guards passed, admin+public verified 9/9 MATCH.

STAGED BEHIND DEPLOY (committed locally as 0537d09, needs git push + Cloudflare deploy with a fresh token, then: APPLY=1 node scripts/t156-import-new.mjs):
30 new products (17 microphones + 13 genuinely-new), images repo-hosted in public/images/products/ (30/30 verified).

Microphones ($12-$960): Microphone Boya M1 ($12.0), Microphone Ahuja ($13.0), Microphone Ahuja Headband ($16.0), Microphone Wireless 3in1 Multi-function ($18.0), Microphone Wireless F11-2 ($18.0), Microphone Wireless Jmary ($35.0), Microphone Wireless Mic Lite ($35.0), DJI Mic Mini Mobile Phone Adapter ($35.0), Rode Interview GO Handheld Mic Adapter ($35.0), Microphone USB Jmary ($38.0), Mic Air (1 TX + 1 RX) ($120.0), Microphone Broadcast RØDE PodMic ($120.0), Microphone BlueYeti ($185.0), Microphone Broadcast RØDE PodMic USB ($200.0), Rode VideoMic Pro ($245.0), Microphone Conference Professional Wireless Siltron ST-3600 ($480.0), Microphone Conference Professional Wireless Siltron ST-8900 ($960.0)

Genuinely-new items: Power Extension Omega 5 Outlet ($14.0), Lens Cleaning Kit K&F Concept ($18.0), Power Bank 20000mAh Green Lion 35W ($22.0), Cable Adapter Lightning to Ethernet RJ45 ($25.0), Power Bank Porodo 30000Mah With Integrated Cable ($35.0), SSD Lexar NS100 512GB 2.5″ SATA III ($85.0), Hp Monitor Series 5 27 inch With Speakers ($220.0), Portable SSD 2TB SanDisk 1,000MB/s ($310.0), HP Printer Color LaserJet Pro MFP 4303fdw ($580.0), Unifi USW 48POE Network Switch Managed ($1240.0), MSI Cyborg 15 Gaming Intel Core 7 240H ($1600.0), Printer Canon image Runner 2425i Monochrome A3 Multifunctional ($2100.0), iPhone Duo 256GB eSim ($2550.0)

Category mapping: microphones -> Power & Charging (audio family; no category-create API/service key available locally).

Skipped/notes: sanguni -2/-3 duplicate listings for A06/A07/A16/MacBook M3-M5 = no real price changes (base listings match). Camera-accessories pages 5+ unreadable via reader cache (only curated-out camera gear affected). Health/immunity rows not sanguni-sourced.

Artifacts: scripts/t156/ (crawl data, diff, import list, results), scripts/t156-sync-prices.mjs, scripts/t156-import-new.mjs, public/images/products/*.
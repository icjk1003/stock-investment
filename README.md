# stock-investment
stock investment



/ (root)
├─ index.html                      # 해당 국가로 자동 리다이렉트 
├─ robots.txt
├─ sitemap.xml
├─ ads.txt                         # AdSense
├─ assets/
│  ├─ ui.css                        # 공용 스타일
│  ├─ app.js                        # 공용 런타임(지역/언어/네비)
│  ├─ i18n.js                       # 공용 사전(최소)
│  ├─ regions.js                    # region 정책(세금/통화/FX)
│  ├─ seo.js                        # canonical/hreflang 헬퍼(선택)
│  ├─ tools/
│  │  ├─ backtest.js                # 백테스트 공용 로직(최종 목표)
│  │  └─ future.js                  # 미래시뮬 공용 로직(최종 목표)
│  └─ partials/
│     ├─ header.html                # 공용 헤더(Region 버튼 포함)
│     └─ footer.html                # 공용 푸터(yy, 링크)
│
├─ kr/
│  ├─ index.html                    # 홈       /시총, 환율, 세금, 정책, investing.com 참고
│  ├─ stock/
│  │  └─ index.html                 # 주식 메인 / 각 guide에서 포스팅한 글을 최신날짜별로 게시
│  ├─ tools/
│  │  ├─ backtest/
│  │  │  └─ index.html              # 백테스트 UI (문구/정책)
│  │  └─ future/
│  │     └─ index.html              # 미래시뮬 UI (문구/정책)
│  └─ guide/
│     ├─ nasdaq
│     │  └─ ticker
│     │      ├─ schd/
│     │      │  └─ index.html          # SCHD 실적 발표일, 주가, 주가 성장률 배당일, 배당금, 배당 성장률, 백테스트, 미래시뮬, 글 올리기 기능 넣기(글 포스팅), 조회수, 좋아요 포스팅 날짜
│     │      ├─ spy/
│     │      │  └─ index.html
│     │      ├─ qqq/
│     │      │  └─ index.html
│     │      ├─ tqqq/
│     │      │  └─ index.html
│     │      └─ tsla/
│     │         └─ index.html
│     ├─ kospi
│     │  └─ ticker
│     │      └─ test/
│     │         └─ index.html
│     │
│     ├─
│
├─ us/
│  ├─ index.html                    # 홈       /시총, 환율, 세금, 정책, investing.com 참고
│  ├─ stock/
│  │  └─ index.html                 # 주식 메인 / 각 guide에서 포스팅한 글을 최신날짜별로 게시
│  ├─ tools/
│  │  ├─ backtest/
│  │  │  └─ index.html              # 백테스트 UI (문구/정책)
│  │  └─ future/
│  │     └─ index.html              # 미래시뮬 UI (문구/정책)
│  └─ guide/
│     ├─ nasdaq
│     │  └─ ticker
│     │      ├─ schd/
│     │      │  └─ index.html          # SCHD 실적 발표일, 주가, 주가 성장률 배당일, 배당금, 배당 성장률, 백테스트, 미래시뮬, 글 올리기 기능 넣기(글 포스팅), 조회수, 좋아요 포스팅 날짜
│     │      ├─ spy/
│     │      │  └─ index.html
│     │      ├─ qqq/
│     │      │  └─ index.html
│     │      ├─ tqqq/
│     │      │  └─ index.html
│     │      └─ tsla/
│     │         └─ index.html
│     ├─ kospi
│     │  └─ ticker
│     │      └─ test/
│     │         └─ index.html
│     │
│     ├─
│
├─ ca/
│  ├─ index.html                    # 홈       /시총, 환율, 세금, 정책, investing.com 참고
│  ├─ stock/
│  │  └─ index.html                 # 주식 메인 / 각 guide에서 포스팅한 글을 최신날짜별로 게시
│  ├─ tools/
│  │  ├─ backtest/
│  │  │  └─ index.html              # 백테스트 UI (문구/정책)
│  │  └─ future/
│  │     └─ index.html              # 미래시뮬 UI (문구/정책)
│  └─ guide/
│     ├─ nasdaq
│     │  └─ ticker
│     │      ├─ schd/
│     │      │  └─ index.html          # SCHD 실적 발표일, 주가, 주가 성장률 배당일, 배당금, 배당 성장률, 백테스트, 미래시뮬, 글 올리기 기능 넣기(글 포스팅), 조회수, 좋아요 포스팅 날짜
│     │      ├─ spy/
│     │      │  └─ index.html
│     │      ├─ qqq/
│     │      │  └─ index.html
│     │      ├─ tqqq/
│     │      │  └─ index.html
│     │      └─ tsla/
│     │         └─ index.html
│     ├─ kospi
│     │  └─ ticker
│     │      └─ test/
│     │         └─ index.html
│     │
│     ├─
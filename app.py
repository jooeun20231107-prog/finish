import re
import streamlit as st
import sqlite3
import hashlib
import secrets
import json
import io
from pathlib import Path
from datetime import datetime

APP_DIR = Path(__file__).resolve().parent
DB_PATH = APP_DIR / "event_on.db"

st.set_page_config(page_title="Event ON", page_icon="🎪", layout="wide", initial_sidebar_state="expanded")

# -------------------- Theme --------------------
st.markdown("""
<style>
.stApp { background:#f6f8fc; color:#17233c; }
.block-container { padding-top:1.5rem; padding-bottom:3rem; max-width:1440px; }
[data-testid="stSidebar"] {
  background:linear-gradient(180deg,#101d3a 0%,#172b50 65%,#1c3761 100%);
  border-right:0;
}
[data-testid="stSidebar"] [data-testid="stMarkdownContainer"] p { color:#c2cde1; }
[data-testid="stSidebar"] hr { border-color:rgba(255,255,255,.16); }
[data-testid="stSidebar"] div.stButton > button {
  background:#fff !important;
  color:#172b4d !important;
  border:1px solid #e0e7f4 !important;
  text-align:left;
  border-radius:12px;
  min-height:2.7rem;
  font-weight:750;
  margin:.12rem 0;
  box-shadow:0 2px 6px rgba(0,0,0,.05);
}
[data-testid="stSidebar"] div.stButton > button p,
[data-testid="stSidebar"] div.stButton > button span,
[data-testid="stSidebar"] div.stButton > button div {
  color:#172b4d !important;
  border:0 !important;
  border-radius:0 !important;
  box-shadow:none !important;
  background:transparent !important;
  margin:0 !important;
  padding:0 !important;
}
[data-testid="stSidebar"] div.stButton>button:hover {
  background:#eaf0ff !important; border-color:#a9beff !important; color:#244bd0 !important;
}
[data-testid="stSidebar"] div.stButton > button[kind="primary"] {
  background:#dfe8ff !important;
  border-color:#a8bdff !important;
  color:#2347bd !important;
}
[data-testid="stSidebar"] div.stButton > button[kind="primary"] p,
[data-testid="stSidebar"] div.stButton > button[kind="primary"] span,
[data-testid="stSidebar"] div.stButton > button[kind="primary"] div {
  color:#2347bd !important;
  background:transparent !important;
  border:0 !important;
  box-shadow:none !important;
  margin:0 !important;
  padding:0 !important;
}
.brand-link {
  display:block; text-decoration:none !important; cursor:pointer; padding:.2rem 0 .4rem;
  color:#fff !important; font-size:1.8rem; font-weight:900; letter-spacing:-.07em; line-height:1.1;
}
.brand-link span { color:#8db0ff; }
.brand-sub { color:#aebdd8; font-size:.65rem; letter-spacing:.14em; font-weight:800; }
.sidebar-label { color:#91a5c8; font-size:.68rem; font-weight:850; letter-spacing:.15em; margin:.8rem 0 .3rem; }
.sidebar-user { background:rgba(255,255,255,.09); border:1px solid rgba(255,255,255,.13); border-radius:15px; padding:.9rem; margin-top:.4rem; }
.sidebar-user-name { font-weight:800; color:#fff; }
.sidebar-user-role { font-size:.8rem; color:#b8c7e2; margin-top:.15rem; }
.hero {
  background:linear-gradient(120deg,#fff 0%,#eef3ff 62%,#e7eeff 100%);
  border:1px solid #e2e9fb; border-radius:26px; padding:clamp(1.5rem,4vw,3.2rem);
  box-shadow:0 14px 40px rgba(39,68,130,.06); margin-bottom:1.5rem;
}
.eyebrow { color:#315be8; font-size:.76rem; font-weight:900; letter-spacing:.15em; }
.hero h1 { font-size:clamp(2.1rem,4.5vw,3.7rem); line-height:1.1; letter-spacing:-.055em; color:#172b4d; margin:.7rem 0 1rem; }
.hero p { font-size:1rem; color:#5c6b84; max-width:750px; line-height:1.85; }
.feature-card { background:#fff; border:1px solid #e5eaf4; border-radius:22px; padding:1.5rem; min-height:178px; box-shadow:0 8px 28px rgba(29,52,96,.045); }
.feature-icon { display:inline-flex; width:48px; height:48px; border-radius:15px; align-items:center; justify-content:center; background:#edf2ff; font-size:1.45rem; margin-bottom:.85rem; }
.feature-card h3 { color:#1d2d50; margin:0 0 .55rem; }
.feature-card p { color:#687791; line-height:1.7; font-size:.93rem; }
.placeholder { background:#fff; border:1.5px dashed #c9d4e6; border-radius:22px; padding:2.4rem 1.5rem; min-height:260px; text-align:center; }
.report-hero { background:linear-gradient(120deg,#152747,#315be8); color:white; border-radius:22px; padding:1.8rem 2rem; margin-bottom:1.1rem; }
.report-hero h2 { color:white; margin:.3rem 0 .6rem; }
.report-hero p { color:#dce6ff; line-height:1.7; }
.metric-card { background:#fff; border:1px solid #e5eaf4; border-radius:16px; padding:1rem 1.1rem; min-height:100px; }
.metric-label { color:#75829a; font-size:.82rem; }
.metric-value { color:#1d2d50; font-size:1.35rem; font-weight:850; margin-top:.3rem; }
div.stButton>button { border-radius:12px; min-height:2.65rem; font-weight:700; }
div.stButton>button[kind="primary"] { background:#315be8; border-color:#315be8; color:#fff; }
div[data-testid="stForm"] { background:#fff; padding:1.2rem; border:1px solid #e5eaf4; border-radius:18px; }
.small-muted { color:#7b8798; font-size:.84rem; }
</style>
""", unsafe_allow_html=True)

# -------------------- Database --------------------
def db_connect():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with db_connect() as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE COLLATE NOCASE,
            display_name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT '기획자',
            salt TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS user_settings (
            user_id INTEGER PRIMARY KEY,
            settings_json TEXT NOT NULL DEFAULT '{}',
            FOREIGN KEY(user_id) REFERENCES users(id)
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            project_name TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )""")
        conn.commit()

def hash_password(password, salt_hex=None):
    salt = bytes.fromhex(salt_hex) if salt_hex else secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 260_000)
    return salt.hex(), digest.hex()

def verify_password(password, salt_hex, expected_hash):
    _, candidate = hash_password(password, salt_hex)
    return secrets.compare_digest(candidate, expected_hash)

def create_user(username, display_name, role, password):
    salt, password_hash = hash_password(password)
    try:
        with db_connect() as conn:
            cur = conn.execute("INSERT INTO users (username,display_name,role,salt,password_hash) VALUES (?,?,?,?,?)",
                               (username.strip(), display_name.strip(), role, salt, password_hash))
            user_id = cur.lastrowid
            conn.execute("INSERT INTO user_settings(user_id,settings_json) VALUES (?,?)", (user_id, json.dumps(default_settings(), ensure_ascii=False)))
            conn.commit()
        return True, "회원가입이 완료됐어요. 로그인해 주세요."
    except sqlite3.IntegrityError:
        return False, "이미 사용 중인 아이디예요."

def authenticate(username, password):
    with db_connect() as conn:
        user = conn.execute("SELECT * FROM users WHERE username=? COLLATE NOCASE", (username.strip(),)).fetchone()
    if user and verify_password(password, user["salt"], user["password_hash"]):
        return dict(user)
    return None

def default_settings():
    return {
        "department": "", "company": "", "report_format": "PDF", "report_detail": "상세",
        "include_recommendations": True, "include_risks": True, "theme": "라이트",
        "compact": False, "analysis_level": "균형", "audience_flow": True,
        "accessibility": True, "notifications": True
    }

def get_settings(user_id):
    if not user_id:
        return default_settings()
    with db_connect() as conn:
        row = conn.execute("SELECT settings_json FROM user_settings WHERE user_id=?", (user_id,)).fetchone()
    if not row:
        return default_settings()
    try:
        data = default_settings()
        data.update(json.loads(row["settings_json"]))
        return data
    except Exception:
        return default_settings()

def save_settings(user_id, settings):
    if not user_id:
        return
    with db_connect() as conn:
        conn.execute("""INSERT INTO user_settings(user_id,settings_json) VALUES (?,?)
            ON CONFLICT(user_id) DO UPDATE SET settings_json=excluded.settings_json""",
            (user_id, json.dumps(settings, ensure_ascii=False)))
        conn.commit()

def save_project(user_id, name, payload):
    with db_connect() as conn:
        conn.execute("INSERT INTO projects(user_id,project_name,payload_json) VALUES (?,?,?)",
                     (user_id, name, json.dumps(payload, ensure_ascii=False)))
        conn.commit()

init_db()
for k, v in {"page":"홈","logged_in":False,"user_id":None,"username":"","display_name":"","role":""}.items():
    if k not in st.session_state: st.session_state[k] = v
if "report_data" not in st.session_state: st.session_state.report_data = {}

# 실제 저장된 화면 설정 적용
_current_settings = get_settings(st.session_state.user_id)
if _current_settings.get("theme") == "다크":
    st.markdown("""
    <style>
    .stApp { background:#101827 !important; color:#e8edf7 !important; }
    [data-testid="stMain"] .stMarkdown, [data-testid="stMain"] label,
    [data-testid="stMain"] p, [data-testid="stMain"] h1, [data-testid="stMain"] h2,
    [data-testid="stMain"] h3, [data-testid="stMain"] h4 { color:#e8edf7 !important; }
    [data-testid="stMain"] div[data-testid="stForm"],
    [data-testid="stMain"] .feature-card, [data-testid="stMain"] .metric-card {
      background:#1a2639 !important; border-color:#33435e !important; color:#e8edf7 !important;
    }
    [data-testid="stMain"] input, [data-testid="stMain"] textarea,
    [data-testid="stMain"] [data-baseweb="select"] > div {
      background:#26344b !important; color:#f3f6fc !important; border-color:#425575 !important;
    }
    </style>
    """, unsafe_allow_html=True)
if _current_settings.get("compact"):
    st.markdown("""
    <style>
    .block-container { padding-top:.65rem !important; padding-bottom:1.2rem !important; }
    [data-testid="stMain"] div[data-testid="stVerticalBlock"] { gap:.65rem; }
    [data-testid="stMain"] .feature-card { min-height:145px; padding:1rem; }
    </style>
    """, unsafe_allow_html=True)

def go(page):
    st.session_state.page = page

# -------------------- Sidebar --------------------
def render_sidebar():
    with st.sidebar:
        # Streamlit reruns on clicks; this link uses query params to route the brand home.
        st.markdown('<a class="brand-link" href="?page=home" target="_self">Event <span>ON</span></a><div class="brand-sub">PLAN SMART. RUN BETTER.</div>', unsafe_allow_html=True)
        st.write("")
        st.markdown('<div class="sidebar-label">WORKSPACE</div>', unsafe_allow_html=True)
        routes = [("⌂", "홈", "홈"), ("▦", "대시보드", "대시보드"), ("▤", "AI 보고서", "AI 보고서")]
        for icon, label, pg in routes:
            if st.button(f"{icon}   {label}", key=f"nav_{pg}", use_container_width=True,
                         type="primary" if st.session_state.page == pg else "secondary"):
                go(pg); st.rerun()
        st.markdown('<div class="sidebar-label">PREFERENCES</div>', unsafe_allow_html=True)
        if st.button("⚙   설정", key="nav_settings", use_container_width=True,
                     type="primary" if st.session_state.page == "설정" else "secondary"):
            go("설정"); st.rerun()
        st.write("")
        st.divider()
        if st.session_state.logged_in:
            name = st.session_state.display_name or st.session_state.username
            st.markdown(f'<div class="sidebar-user"><div class="sidebar-user-name">● &nbsp; {name}님</div><div class="sidebar-user-role">{st.session_state.role}</div></div>', unsafe_allow_html=True)
            if st.button("로그아웃", key="logout", use_container_width=True):
                for k,v in {"logged_in":False,"user_id":None,"username":"","display_name":"","role":"","page":"홈"}.items():
                    st.session_state[k]=v
                st.rerun()
        else:
            st.markdown('<div class="sidebar-label">YOUR ACCOUNT</div>', unsafe_allow_html=True)
            if st.button("↗   로그인 / 회원가입", key="nav_login", use_container_width=True):
                go("로그인"); st.rerun()

# Query param brand navigation
try:
    qp = st.query_params.get("page")
    if qp == "home":
        st.session_state.page = "홈"
        st.query_params.clear()
except Exception:
    pass

# -------------------- Pages --------------------
def render_home():
    st.markdown("""<div class="hero"><div class="eyebrow">AI EVENT PLANNING PLATFORM</div>
    <h1>좋은 행사는<br>좋은 설계에서 시작됩니다.</h1>
    <p>행사 기획부터 공간 운영까지, 필요한 작업을 한곳에서 관리하세요.
    Event ON은 더 체계적인 행사 준비를 위한 스마트 워크스페이스입니다.</p></div>""", unsafe_allow_html=True)
    st.markdown("## 무엇을 시작할까요?")
    st.caption("필요한 작업을 선택해 이동하세요.")
    a,b=st.columns(2,gap="large")
    with a:
        st.markdown('<div class="feature-card"><div class="feature-icon">▦</div><h3>대시보드</h3><p>행사 설계 및 공간 분석을 위한 작업 공간입니다. 대시보드 담당자의 코드를 연결할 수 있습니다.</p></div>',unsafe_allow_html=True)
        if st.button("대시보드 열기  →",type="primary",use_container_width=True,key="home_dash"): go("대시보드"); st.rerun()
    with b:
        st.markdown('<div class="feature-card"><div class="feature-icon">▤</div><h3>AI 보고서 다운로드</h3><p>행사 계획, 운영 전략, 위험 관리 및 권장 사항을 정리한 전문 보고서를 생성합니다.</p></div>',unsafe_allow_html=True)
        if st.button("보고서 만들기  →",type="primary",use_container_width=True,key="home_report"): go("AI 보고서"); st.rerun()

def render_dashboard():
    st.markdown('<div class="eyebrow">WORKSPACE</div>',unsafe_allow_html=True); st.title("대시보드")
    st.markdown('<div class="placeholder"><div style="font-size:2.4rem">🧩</div><h3>대시보드 콘텐츠 영역</h3><p>이곳에 행사 정보 입력, 공간 배치, 평면도 및 시뮬레이션 등<br>대시보드 담당자의 코드를 연결하면 됩니다.</p><p class="small-muted">현재는 기능 충돌 방지를 위해 비워 두었습니다.</p></div>',unsafe_allow_html=True)


def format_formal_report(markdown_text: str) -> str:
    """보고서 번호 체계를 1. → 가. → 1) 순서로 만들고, 각 항목을 별도 줄에 표시한다.

    Markdown 미리보기에서 한 줄로 합쳐지지 않도록 각 줄 끝에 Markdown 강제 줄바꿈
    공백 두 개를 넣는다. 항목 앞 들여쓰기는 Markdown 코드 블록으로 해석될 수 있어 쓰지 않는다.
    """
    out = []
    main_no = 0
    sub_no = 0
    detail_no = 0
    hangul = "가나다라마바사아자차카타파하"

    for raw in markdown_text.splitlines():
        stripped = raw.strip()
        if not stripped:
            out.append("")
            continue

        if stripped.startswith("# "):
            rendered = stripped[2:].strip()
        elif stripped.startswith("## "):
            main_no += 1
            sub_no = 0
            detail_no = 0
            title = re.sub(r"^\d+[.)]\s*", "", stripped[3:].strip())
            rendered = f"{main_no}. {title}"
        elif stripped.startswith("### "):
            sub_no += 1
            detail_no = 0
            title = re.sub(r"^[가-하]\.\s*", "", stripped[4:].strip())
            marker = f"{hangul[sub_no - 1]}." if sub_no <= len(hangul) else f"({sub_no})"
            rendered = f"　{marker} {title}"
        elif re.match(r"^[-*]\s+", stripped):
            detail_no += 1
            item = re.sub(r"^[-*]\s+", "", stripped)
            item = re.sub(r"^\[\s*\]\s*", "□ ", item)
            rendered = f"　　{detail_no}) {item}"
        elif stripped == "---":
            rendered = "---"
        else:
            rendered = stripped

        # Markdown hard line break: Streamlit 미리보기에서 항목마다 다음 줄로 내려가게 함.
        out.append(rendered + "  ")
    return "\n".join(out)


def _numbering_smoke_test():
    sample = "# 테스트 보고서\\n## 추진 목적\\n### 추진 배경\\n- 행사 필요성\\n- 운영 목표"
    result = format_formal_report(sample)
    expected = ["1. 추진 목적", "가. 추진 배경", "1) 행사 필요성", "2) 운영 목표"]
    return all(item in result for item in expected), result


def build_report_text(d, settings):
    """행사 입력값과 사용자 설정을 반영해 실제 업무용 보고서 초안을 작성."""
    event_name = d.get("event_name") or "행사 운영 계획"
    event_type = d.get("event_type", "기타")
    purpose = d.get("purpose", "행사 목적 미입력")
    venue = d.get("venue", "미정")
    event_date = d.get("date", "미정")
    hours = d.get("hours", "미정")
    visitors = int(d.get("visitors", 0) or 0)
    budget = d.get("budget", "미정")
    audience = d.get("audience", "전 연령")
    mood = d.get("mood", "전문적인")
    facilities = d.get("facilities", "기본 안내 시설")
    detail = settings.get("report_detail", "상세")
    analysis = settings.get("analysis_level", "균형")

    lines = [
        f"# {event_name} 행사 운영 계획 보고서",
        f"**작성일:** {datetime.now().strftime('%Y년 %m월 %d일')}",
        "**작성 도구:** Event ON 행사 기획 지원",
        "",
        "## 추진 개요",
        "### 추진 목적",
        f"- {purpose}",
        "### 추진 방향",
        f"- 행사 유형과 주요 대상({audience})의 특성을 고려해 프로그램과 안내 방식을 구성합니다.",
        f"- 행사 분위기는 '{mood}'를 기준으로 통일하고, 방문객 편의와 안전을 함께 고려합니다.",
        "",
        "## 행사 개요",
        "### 행사 기본 정보",
        f"- 행사명: {event_name}",
        f"- 행사 유형: {event_type}",
        f"- 행사 일시: {event_date} / {hours}",
        f"- 행사 장소: {venue}",
        f"- 주요 대상: {audience}",
        f"- 예상 방문객: {visitors:,}명",
        f"- 소요 예산: {budget}",
        "### 운영 시설",
        f"- 필요 시설: {facilities}",
        "",
        "## 세부 추진 계획",
        "### 사전 준비",
        "- 행사 담당자별 업무와 의사결정 담당자를 지정하고, 행사 전 공유 회의를 진행합니다.",
        "- 장소 사용 가능 시간, 시설 설치 조건, 전력·통신 환경 및 반입 절차를 확인합니다.",
        "- 프로그램별 준비 완료 시각과 점검 담당자를 정하고, 변경 사항을 공유할 연락 체계를 마련합니다.",
        "### 현장 운영",
        "- 개장 전 안내 표지, 접수 장비, 시설 상태 및 비상구 주변의 장애물 여부를 확인합니다.",
        "- 입장 안내, 프로그램 진행, 시설 관리, 방문객 문의 대응 업무를 구분해 운영합니다.",
        "- 운영 중 주요 문의와 현장 이슈를 기록하고, 필요한 경우 책임자에게 즉시 보고합니다.",
        "### 종료 및 사후 정리",
        "- 방문객 퇴장 흐름을 안내하고, 혼잡이 발생하는 구간에는 현장 인력을 배치합니다.",
        "- 시설과 장비를 확인하고 분실물·폐기물·대여 물품을 정리합니다.",
        "- 방문객 수, 문의 내용, 운영상 문제 및 개선 의견을 기록해 결과 검토 자료로 활용합니다.",
    ]

    if detail in ("표준", "상세"):
        lines += [
            "",
            "## 인력 및 역할 운영",
            "### 업무 분장",
            "- 총괄 담당: 전체 일정과 현장 의사결정, 유관 담당자 간 조정을 맡습니다.",
            "- 안내·접수 담당: 입장 확인, 행사 안내, 문의 응대 및 대기 줄 관리를 맡습니다.",
            "- 시설·프로그램 담당: 시설 상태와 프로그램 진행 상황을 점검하고 문제 발생 시 공유합니다.",
            "- 안전 담당: 비상 통로와 혼잡 구역을 확인하고 비상 연락 절차를 숙지합니다.",
            "### 운영 커뮤니케이션",
            "- 행사 전 담당자 연락망과 보고 기준을 공유하고, 현장 변경 사항은 동일한 안내 체계로 전달합니다.",
            "- 실제 인력 수와 근무 시간은 행사 규모, 장소 조건 및 프로그램 수를 확인한 뒤 확정합니다.",
        ]

    if settings.get("include_recommendations", True):
        lines += [
            "",
            "## 운영 개선 및 권장 사항",
            "### 방문객 경험 개선",
            "- 입구, 접수대, 주요 프로그램, 휴게 시설 및 출구의 안내 표지를 일관된 방식으로 배치합니다.",
            "- 반복 문의가 예상되는 정보는 안내판 또는 온라인 안내 페이지에 미리 제공합니다.",
            "- 대기 공간과 휴식 공간을 구분해 통행 흐름을 유지하고 방문객이 머무를 장소를 확보합니다.",
            "### 운영 효율 개선",
            "- 프로그램별 담당자와 준비 완료 시각을 정해 현장 지연 가능성을 줄입니다.",
            "- 행사 종료 후 방문객 수, 대기 시간, 자주 발생한 문의 및 운영 문제를 정리해 다음 행사에 반영합니다.",
        ]

    if settings.get("audience_flow", True):
        lines += [
            "",
            "## 방문객 동선 계획",
            "### 기본 동선 원칙",
            "- 입구에서 접수·주요 프로그램·휴게 시설·출구로 이어지는 이동 흐름이 자연스럽게 연결되도록 안내합니다.",
            "- 대기 줄이 주 통로와 비상 통로를 막지 않도록 대기 공간을 별도로 검토합니다.",
            "- 실제 공간 배치가 확정되면 교차 지점과 혼잡 예상 구역을 현장에서 확인하고 안내 인력을 배치합니다.",
        ]

    if settings.get("accessibility", True):
        lines += [
            "",
            "## 접근성 및 편의 지원",
            "### 이용 편의 확인",
            "- 이동 약자도 접근할 수 있는 출입 경로와 시설 이용 가능 여부를 사전에 확인합니다.",
            "- 안내 표지는 읽기 쉬운 글자 크기와 명확한 색상 대비를 적용하고, 주요 분기점에 반복 배치합니다.",
            "- 필요한 경우 휴게 공간, 가족 편의 시설 및 현장 문의 지원 방법을 안내합니다.",
        ]

    if settings.get("include_risks", True):
        lines += [
            "",
            "## 위험 요소 및 대응 계획",
            "### 혼잡 및 안전사고",
            "- 예상 상황: 입장·접수 구역이나 인기 프로그램 주변에 방문객이 집중될 수 있습니다.",
            "- 대응 방안: 대기 공간과 통행 공간을 구분하고, 혼잡 시 현장 안내 인력을 추가 배치합니다.",
            "### 응급 상황",
            "- 예상 상황: 방문객의 건강 이상이나 시설 이용 중 응급 상황이 발생할 수 있습니다.",
            "- 대응 방안: 비상 연락 체계와 응급 지원 위치를 사전에 공유하고, 현장 담당자의 보고 절차를 확인합니다.",
            "### 일정 지연 및 장비 문제",
            "- 예상 상황: 프로그램 준비 지연이나 음향·전력·통신 장비 문제가 발생할 수 있습니다.",
            "- 대응 방안: 사전 점검을 실시하고, 지연 시 안내 문구와 대체 진행 순서를 마련합니다.",
        ]

    lines += [
        "",
        "## 행사 당일 점검 사항",
        "### 개장 전",
        "- [ ] 출입구·비상구·주요 통로와 안내 표지 확인",
        "- [ ] 접수 장비, 음향·전력·통신 장비 점검",
        "- [ ] 담당자별 역할과 비상 연락망 공유",
        "### 운영 중",
        "- [ ] 방문객 흐름과 대기 구역 확인",
        "- [ ] 시설 상태 및 주요 프로그램 진행 상황 점검",
        "- [ ] 현장 이슈 기록 및 책임자 공유",
        "### 종료 후",
        "- [ ] 방문객 퇴장 안내 및 시설·장비 정리",
        "- [ ] 분실물·폐기물·대여 물품 확인",
        "- [ ] 운영 결과와 개선 사항 기록",
        "",
        "## 기대 효과",
        "### 기대 성과",
        "- 행사 준비와 현장 운영의 역할을 구체화해 운영 과정의 혼선을 줄일 수 있습니다.",
        "- 안내 체계와 동선 관리 기준을 사전에 마련해 방문객 편의와 안전을 높일 수 있습니다.",
        "- 행사 종료 후 운영 기록을 축적해 향후 행사 기획과 개선에 활용할 수 있습니다.",
        "",
        "## 작성 시 유의 사항",
        "- 본 문서는 입력된 정보를 바탕으로 작성한 행사 운영 계획 초안입니다.",
        "- 실제 인력 배치, 예산 집행, 공간 배치 및 안전 조치는 현장 조건과 관계 기준을 확인한 뒤 확정해야 합니다.",
    ]

    if detail == "요약" or analysis == "간결":
        # 요약 설정은 핵심 항목 중심으로 구성
        keep_main = {
            "추진 개요", "행사 개요", "세부 추진 계획",
            "운영 개선 및 권장 사항", "위험 요소 및 대응 계획",
            "행사 당일 점검 사항", "기대 효과", "작성 시 유의 사항"
        }
        filtered = []
        active = False
        for line in lines:
            if line.startswith("# "):
                filtered.append(line)
            elif line.startswith("## "):
                title = line[3:].strip()
                active = title in keep_main
                if active:
                    filtered.append(line)
            elif active:
                filtered.append(line)
        lines = filtered
    elif analysis == "세부 분석":
        lines += [
            "",
            "## 추가 검토 필요 사항",
            "### 현장 확정 전 확인",
            "- 행사장 실측 도면, 수용 가능 인원, 통로 폭 및 실제 시설 위치는 별도 확인이 필요합니다.",
            "- 실제 인력 수, 단가별 예산, 프로그램별 소요 시간 및 비상 대응 담당자는 확정 정보에 따라 보완해야 합니다.",
        ]

    return "\n".join(lines)

def create_pdf(report_text, title):
    # PDF generation with ReportLab. Font fallback keeps Korean readable where a CJK font is available.
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_LEFT
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
    from reportlab.lib.units import mm
    from xml.sax.saxutils import escape
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=18*mm, bottomMargin=18*mm)
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=22, leading=28, textColor=colors.HexColor("#2447a8"), alignment=TA_LEFT, spaceAfter=10))
    styles.add(ParagraphStyle(name="Section", parent=styles["Heading2"], fontSize=13, leading=18, textColor=colors.HexColor("#2447a8"), spaceBefore=10, spaceAfter=5))
    styles.add(ParagraphStyle(name="BodyCustom", parent=styles["BodyText"], fontSize=9.5, leading=14, spaceAfter=4))
    story=[]
    for line in report_text.splitlines():
        if line.startswith("# "):
            story.append(Paragraph(escape(line[2:]), styles["CoverTitle"]))
        elif line.startswith("## "):
            story.append(Spacer(1,5))
            story.append(Paragraph(escape(line[3:]), styles["Section"]))
        elif line.startswith("### "):
            story.append(Paragraph("<b>" + escape(line[4:]) + "</b>", styles["BodyCustom"]))
        elif re.match(r"^\s*\d+\.\s+", line):
            story.append(Spacer(1, 4))
            story.append(Paragraph("<b>" + escape(line.strip()) + "</b>", styles["Section"]))
        elif re.match(r"^\s*[가-하]\.\s+", line):
            story.append(Paragraph("<b>" + escape(line.strip()) + "</b>", styles["BodyCustom"]))
        elif re.match(r"^\s*\d+\)\s+", line):
            story.append(Paragraph(escape(line.strip()), styles["BodyCustom"]))
        elif line.startswith("- "):
            story.append(Paragraph("• " + escape(line[2:]), styles["BodyCustom"]))
        elif line.startswith("**") and line.endswith("**"):
            story.append(Paragraph("<b>"+escape(line.strip("*"))+"</b>", styles["BodyCustom"]))
        elif line == "---":
            story.append(Spacer(1,8))
        elif line.strip():
            story.append(Paragraph(escape(line), styles["BodyCustom"]))
        else:
            story.append(Spacer(1,3))
    doc.build(story)
    return buf.getvalue()

def render_report():
    st.markdown('<div class="report-hero"><div style="font-size:.75rem;letter-spacing:.15em;font-weight:800">EVENT ON · REPORT STUDIO</div><h2>행사 운영 보고서</h2><p>행사 정보를 입력하면 운영 계획, 권장 사항, 위험 대응, 당일 체크리스트를 포함한 보고서 초안을 생성합니다.</p></div>',unsafe_allow_html=True)
    settings = get_settings(st.session_state.user_id)
    st.markdown("### 1. 행사 정보")
    with st.form("report_form"):
        c1,c2=st.columns(2)
        with c1:
            event_name=st.text_input("행사명", value=st.session_state.report_data.get("event_name",""))
            event_type=st.selectbox("행사 유형",["축제·페스티벌","전시회","컨퍼런스·세미나","학교 행사","기업 행사","체험 행사","지역 행사","기타"])
            purpose=st.text_area("행사 목적", placeholder="예: 신제품 소개 및 방문객 체험 제공", height=90)
            venue=st.text_input("행사 장소", placeholder="예: 실내 전시장 A홀")
            date=st.date_input("행사 날짜")
        with c2:
            visitors=st.number_input("예상 방문객 수", min_value=1, max_value=1000000, value=300, step=50)
            budget=st.text_input("예산", placeholder="예: 15,000,000원")
            hours=st.text_input("운영 시간", placeholder="예: 10:00–18:00")
            audience=st.selectbox("주요 대상",["전 연령","어린이·가족","청소년","청년","성인","업계 관계자"])
            mood=st.selectbox("원하는 분위기",["활기찬","감성적인","전문적인","가족 친화적인","캐주얼한"])
        facilities=st.multiselect("필요한 시설",["안내센터","접수대","공연장","체험 부스","전시 부스","푸드존","휴게공간","응급의료센터","수유·가족 휴게실","물품 보관소"],default=["안내센터","휴게공간","응급의료센터"])
        submitted=st.form_submit_button("보고서 초안 생성",type="primary",use_container_width=True)
    if submitted:
        data={"event_name":event_name.strip() or "행사 운영 계획","event_type":event_type,"purpose":purpose.strip() or "행사 목적 미입력","venue":venue.strip() or "미정","date":str(date),"visitors":int(visitors),"budget":budget.strip() or "미정","hours":hours.strip() or "미정","audience":audience,"mood":mood,"facilities":", ".join(facilities) if facilities else "기본 안내 시설"}
        st.session_state.report_data=data
        st.session_state.report_text = format_formal_report(build_report_text(data,settings))
        if st.session_state.logged_in:
            try: save_project(st.session_state.user_id, data["event_name"], {"event":data,"report":st.session_state.report_text})
            except Exception: pass
        st.success("보고서 초안이 생성됐어요. 아래에서 내용을 검토하고 다운로드할 수 있습니다.")
    if st.session_state.get("report_text"):
        report_text=st.session_state.report_text
        st.divider()
        st.markdown("### 2. 보고서 미리보기")
        data=st.session_state.report_data
        m1,m2,m3=st.columns(3)
        for col,label,value in [(m1,"예상 방문객",f'{data.get("visitors",0):,}명'),(m2,"행사 유형",data.get("event_type","-")),(m3,"운영 날짜",data.get("date","-"))]:
            with col:
                st.markdown(f'<div class="metric-card"><div class="metric-label">{label}</div><div class="metric-value">{value}</div></div>',unsafe_allow_html=True)
        with st.expander("보고서 내용 확인",expanded=True):
            st.markdown(report_text)
        x,y=st.columns(2)
        with x:
            st.download_button("⬇ Markdown 보고서 다운로드",data=report_text.encode("utf-8"),file_name="Event_ON_행사운영보고서.md",mime="text/markdown",use_container_width=True)
        with y:
            try:
                pdf_bytes=create_pdf(report_text,data.get("event_name","Event_ON_보고서"))
                st.download_button("⬇ PDF 보고서 다운로드",data=pdf_bytes,file_name="Event_ON_행사운영보고서.pdf",mime="application/pdf",type="primary",use_container_width=True)
            except Exception as e:
                st.warning("PDF 생성에 실패했습니다. Markdown 보고서를 이용해 주세요.")
                st.caption("배포 환경에서 reportlab 설치 여부를 확인해 주세요.")
    else:
        st.info("행사 정보를 입력한 뒤 ‘보고서 초안 생성’을 누르면 미리보기와 다운로드 버튼이 표시됩니다.")

def render_settings():
    st.markdown('<div class="eyebrow">PREFERENCES</div>',unsafe_allow_html=True)
    st.title("설정")
    settings=get_settings(st.session_state.user_id)
    tabs=st.tabs(["계정 및 프로필","보고서 설정","화면 설정","AI 분석 설정","프로젝트 및 저장 관리","보안 및 계정 관리"])

    with tabs[0]:
        st.subheader("계정 및 프로필")
        if st.session_state.logged_in:
            with st.form("profile_form"):
                display=st.text_input("표시 이름",value=st.session_state.display_name)
                role=st.selectbox("역할",["기획자","관리자","팀원","상사"],index=["기획자","관리자","팀원","상사"].index(st.session_state.role) if st.session_state.role in ["기획자","관리자","팀원","상사"] else 0)
                department=st.text_input("부서",value=settings.get("department",""))
                company=st.text_input("회사 / 기관",value=settings.get("company",""))
                save=st.form_submit_button("프로필 저장",type="primary")
            if save:
                with db_connect() as conn:
                    conn.execute("UPDATE users SET display_name=?,role=? WHERE id=?",(display.strip() or st.session_state.username,role,st.session_state.user_id)); conn.commit()
                settings.update({"department":department,"company":company}); save_settings(st.session_state.user_id,settings)
                st.session_state.display_name=display.strip() or st.session_state.username; st.session_state.role=role
                st.success("프로필을 저장했어요."); st.rerun()
        else:
            st.info("프로필을 수정하려면 먼저 로그인해 주세요.")

    with tabs[1]:
        st.subheader("보고서 설정")
        with st.form("report_settings_form"):
            fmt=st.selectbox("기본 보고서 형식",["PDF","Markdown"],index=["PDF","Markdown"].index(settings.get("report_format","PDF")))
            detail=st.selectbox("보고서 상세 수준",["요약","표준","상세"],index=["요약","표준","상세"].index(settings.get("report_detail","상세")))
            recommendations=st.checkbox("운영 개선 제안 포함",value=settings.get("include_recommendations",True))
            risks=st.checkbox("위험 요소 및 대응 방안 포함",value=settings.get("include_risks",True))
            if st.form_submit_button("보고서 설정 저장",type="primary"):
                settings.update({"report_format":fmt,"report_detail":detail,"include_recommendations":recommendations,"include_risks":risks})
                save_settings(st.session_state.user_id,settings)
                st.success("보고서 설정을 저장했어요." if st.session_state.logged_in else "로그인하지 않아 설정을 계정에 저장할 수 없어요. 로그인 후 다시 저장해 주세요.")
                if st.session_state.logged_in: st.rerun()

    with tabs[2]:
        st.subheader("화면 설정")
        with st.form("screen_settings_form"):
            theme=st.selectbox("테마",["라이트","다크"],index=["라이트","다크"].index(settings.get("theme","라이트")))
            compact=st.checkbox("간격을 좁게 표시",value=settings.get("compact",False))
            if st.form_submit_button("화면 설정 저장",type="primary"):
                settings.update({"theme":theme,"compact":compact}); save_settings(st.session_state.user_id,settings)
                st.success("화면 설정을 저장했어요. 테마와 간격 설정을 적용합니다." if st.session_state.logged_in else "로그인하지 않아 설정을 계정에 저장할 수 없어요. 로그인 후 다시 저장해 주세요.")
                if st.session_state.logged_in: st.rerun()

    with tabs[3]:
        st.subheader("AI 분석 설정")
        with st.form("ai_settings_form"):
            level=st.selectbox("분석 성향",["간결","균형","세부 분석"],index=["간결","균형","세부 분석"].index(settings.get("analysis_level","균형")))
            flow=st.checkbox("방문객 동선 관련 제안 포함",value=settings.get("audience_flow",True))
            access=st.checkbox("접근성 및 편의 사항 검토",value=settings.get("accessibility",True))
            notify=st.checkbox("생성 완료 안내 표시",value=settings.get("notifications",True))
            if st.form_submit_button("AI 분석 설정 저장",type="primary"):
                settings.update({"analysis_level":level,"audience_flow":flow,"accessibility":access,"notifications":notify})
                save_settings(st.session_state.user_id,settings)
                st.success("AI 분석 설정을 저장했어요. 다음 보고서 생성부터 반영됩니다." if st.session_state.logged_in else "로그인하지 않아 설정을 계정에 저장할 수 없어요. 로그인 후 다시 저장해 주세요.")
                if st.session_state.logged_in: st.rerun()

    with tabs[4]:
        st.subheader("프로젝트 및 저장 관리")
        if not st.session_state.logged_in:
            st.info("프로젝트 저장 및 목록 확인은 로그인 후 이용할 수 있습니다.")
        else:
            with db_connect() as conn:
                projects=conn.execute("SELECT id,project_name,created_at FROM projects WHERE user_id=? ORDER BY id DESC",(st.session_state.user_id,)).fetchall()
            st.write(f"저장된 프로젝트: **{len(projects)}개**")
            if projects:
                for p in projects:
                    c1,c2=st.columns([4,1])
                    c1.write(f"**{p['project_name']}**  ·  {p['created_at']}")
                    if c2.button("삭제",key=f"del_project_{p['id']}"):
                        with db_connect() as conn:
                            conn.execute("DELETE FROM projects WHERE id=? AND user_id=?",(p["id"],st.session_state.user_id)); conn.commit()
                        st.rerun()
                with db_connect() as conn:
                    rows=conn.execute("SELECT project_name,payload_json,created_at FROM projects WHERE user_id=? ORDER BY id DESC",(st.session_state.user_id,)).fetchall()
                export=[dict(name=r["project_name"],created_at=r["created_at"],data=json.loads(r["payload_json"])) for r in rows]
                st.download_button("전체 프로젝트 백업 다운로드 (JSON)",data=json.dumps(export,ensure_ascii=False,indent=2).encode("utf-8"),file_name="Event_ON_projects_backup.json",mime="application/json")
            else:
                st.caption("아직 저장된 프로젝트가 없습니다. AI 보고서를 생성하면 프로젝트가 자동 저장됩니다.")

    with tabs[5]:
        st.subheader("보안 및 계정 관리")
        if not st.session_state.logged_in:
            st.info("비밀번호 변경 및 계정 삭제는 로그인 후 이용할 수 있습니다.")
        else:
            with st.form("password_change_form"):
                current=st.text_input("현재 비밀번호",type="password")
                new1=st.text_input("새 비밀번호 (8자 이상)",type="password")
                new2=st.text_input("새 비밀번호 확인",type="password")
                change=st.form_submit_button("비밀번호 변경",type="primary")
            if change:
                user=authenticate(st.session_state.username,current) if current else None
                if not user: st.error("현재 비밀번호가 올바르지 않습니다.")
                elif len(new1)<8: st.error("새 비밀번호는 8자 이상이어야 합니다.")
                elif new1!=new2: st.error("새 비밀번호가 서로 일치하지 않습니다.")
                else:
                    salt,ph=hash_password(new1)
                    with db_connect() as conn:
                        conn.execute("UPDATE users SET salt=?,password_hash=? WHERE id=?",(salt,ph,st.session_state.user_id)); conn.commit()
                    st.success("비밀번호를 변경했어요.")
            st.divider()
            st.warning("계정 삭제 시 계정과 저장된 프로젝트가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.")
            confirm=st.checkbox("계정을 영구 삭제하는 것에 동의합니다.",key="confirm_delete_account")
            if st.button("내 계정 삭제",type="secondary",disabled=not confirm,key="delete_account"):
                with db_connect() as conn:
                    conn.execute("DELETE FROM projects WHERE user_id=?",(st.session_state.user_id,))
                    conn.execute("DELETE FROM user_settings WHERE user_id=?",(st.session_state.user_id,))
                    conn.execute("DELETE FROM users WHERE id=?",(st.session_state.user_id,))
                    conn.commit()
                for k,v in {"logged_in":False,"user_id":None,"username":"","display_name":"","role":"","page":"홈"}.items(): st.session_state[k]=v
                st.success("계정과 연결된 프로젝트를 삭제했어요."); st.rerun()

def main():
    render_sidebar()
    page=st.session_state.page
    if page=="홈": render_home()
    elif page=="대시보드": render_dashboard()
    elif page=="AI 보고서": render_report()
    elif page=="설정": render_settings()
    elif page=="로그인": render_auth()
    else: render_home()

def render_auth():
    st.markdown('<div class="eyebrow">YOUR ACCOUNT</div>',unsafe_allow_html=True)
    st.title("로그인 / 회원가입")
    login_tab,signup_tab=st.tabs(["로그인","회원가입"])
    with login_tab:
        with st.form("login_form"):
            username=st.text_input("아이디")
            password=st.text_input("비밀번호",type="password")
            submitted=st.form_submit_button("로그인",type="primary",use_container_width=True)
        if submitted:
            user=authenticate(username,password) if username.strip() and password else None
            if user:
                st.session_state.logged_in=True; st.session_state.user_id=user["id"]; st.session_state.username=user["username"]
                st.session_state.display_name=user["display_name"]; st.session_state.role=user["role"]; st.session_state.page="홈"
                st.success("로그인했어요."); st.rerun()
            else: st.error("아이디 또는 비밀번호를 확인해 주세요.")
    with signup_tab:
        with st.form("signup_form"):
            username=st.text_input("아이디")
            display=st.text_input("표시 이름")
            role=st.text_input("역할",placeholder="예: 기획자, 팀장, 디자이너, 외부 협력사")
            pw1=st.text_input("비밀번호 (8자 이상)",type="password")
            pw2=st.text_input("비밀번호 확인",type="password")
            submitted=st.form_submit_button("회원가입",type="primary",use_container_width=True)
        if submitted:
            if not username.strip() or not display.strip() or not role.strip() or not pw1: st.error("모든 항목을 입력해 주세요.")
            elif len(username.strip())<3: st.error("아이디는 3자 이상이어야 합니다.")
            elif len(pw1)<8: st.error("비밀번호는 8자 이상이어야 합니다.")
            elif pw1!=pw2: st.error("비밀번호가 일치하지 않습니다.")
            else:
                ok,msg=create_user(username,display,role,pw1)
                (st.success if ok else st.error)(msg)

if __name__=="__main__":
    main()

import streamlit as st
import sqlite3
import hashlib
import secrets
from pathlib import Path

# =========================================================
# Event ON | 공통 UI + 실제 로컬 로그인/회원가입
# 대시보드와 AI 보고서의 본 기능은 추후 별도 코드로 연결합니다.
# =========================================================

APP_DIR = Path(__file__).resolve().parent
DB_PATH = APP_DIR / "event_on.db"

st.set_page_config(
    page_title="Event ON",
    page_icon="🎪",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ---------- 디자인 ----------
st.markdown("""
<style>
:root { color-scheme: light; }
.stApp { background: #f6f8fc; color: #17233c; }
.block-container { padding-top: 1.5rem; padding-bottom: 3rem; max-width: 1440px; }
[data-testid="stSidebar"] {
    background: linear-gradient(180deg, #101d3a 0%, #172b50 60%, #1c3761 100%);
    border-right: 0;
}
[data-testid="stSidebar"] * { color: #edf3ff; }
[data-testid="stSidebar"] [data-testid="stMarkdownContainer"] p { color: #aebdd8; }
[data-testid="stSidebar"] hr { border-color: rgba(255,255,255,.16); }
[data-testid="stSidebar"] div.stButton > button {
    background: transparent; color: #edf3ff; border: 1px solid transparent;
    text-align: left; border-radius: 12px; min-height: 2.75rem;
    font-weight: 600; transition: all .15s ease;
}
[data-testid="stSidebar"] div.stButton > button:hover {
    background: rgba(255,255,255,.10); border-color: rgba(255,255,255,.12);
}
[data-testid="stSidebar"] div.stButton > button[kind="primary"] {
    background: #315be8; color: white; border-color: #315be8;
}
.brand-word {
    font-size: 1.75rem; font-weight: 900; letter-spacing: -.065em;
    color: #fff; line-height: 1.1; padding: .5rem 0 .2rem;
}
.brand-word span { color: #82a6ff; }
.brand-sub { color: #aebdd8; font-size: .68rem; letter-spacing: .16em; font-weight: 700; }
.sidebar-label { color: #91a5c8; font-size: .68rem; font-weight: 800; letter-spacing: .15em; margin: .8rem 0 .3rem; }
.sidebar-user {
    background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12);
    border-radius: 15px; padding: .9rem; margin-top: .4rem;
}
.sidebar-user-name { font-weight: 800; color: #fff; }
.sidebar-user-role { font-size: .8rem; color: #aebdd8; margin-top: .15rem; }
.hero {
    background: linear-gradient(120deg, #ffffff 0%, #eef3ff 62%, #e7eeff 100%);
    border: 1px solid #e2e9fb; border-radius: 26px; padding: clamp(1.5rem, 4vw, 3.2rem);
    box-shadow: 0 14px 40px rgba(39, 68, 130, .06); margin-bottom: 1.5rem;
}
.eyebrow { color: #315be8; font-size: .76rem; font-weight: 900; letter-spacing: .15em; }
.hero h1 { font-size: clamp(2.1rem, 4.5vw, 3.7rem); line-height: 1.1; letter-spacing: -.055em; color: #172b4d; margin: .7rem 0 1rem; }
.hero p { font-size: 1rem; color: #5c6b84; max-width: 750px; line-height: 1.85; }
.section-heading { color: #172b4d; font-weight: 850; letter-spacing: -.03em; }
.feature-card {
    background: #fff; border: 1px solid #e5eaf4; border-radius: 22px;
    padding: 1.5rem; min-height: 178px; box-shadow: 0 8px 28px rgba(29, 52, 96, .045);
}
.feature-icon {
    display: inline-flex; width: 48px; height: 48px; border-radius: 15px;
    align-items: center; justify-content: center; background: #edf2ff;
    font-size: 1.45rem; margin-bottom: .85rem;
}
.feature-card h3 { color: #1d2d50; margin: 0 0 .55rem; letter-spacing: -.025em; }
.feature-card p { color: #687791; line-height: 1.7; font-size: .93rem; }
.placeholder {
    background: #fff; border: 1.5px dashed #c9d4e6; border-radius: 22px;
    padding: 2.4rem 1.5rem; min-height: 300px; text-align: center;
    display: flex; flex-direction: column; justify-content: center;
}
.placeholder h3 { color: #344563; }
.placeholder p { color: #718096; line-height: 1.8; }
div.stButton > button { border-radius: 12px; min-height: 2.75rem; font-weight: 700; }
div.stButton > button[kind="primary"] { background: #315be8; border-color: #315be8; color: #fff; }
div[data-testid="stForm"] { background: #fff; padding: 1.2rem; border: 1px solid #e5eaf4; border-radius: 18px; }
div[data-testid="stTabs"] button { font-weight: 700; }
.small-muted { color: #7b8798; font-size: .84rem; }
</style>
""", unsafe_allow_html=True)


# ---------- DB / 보안 ----------
def db_connect():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with db_connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                display_name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT '기획자',
                salt TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
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
            conn.execute(
                "INSERT INTO users (username, display_name, role, salt, password_hash) VALUES (?, ?, ?, ?, ?)",
                (username.strip(), display_name.strip(), role, salt, password_hash),
            )
            conn.commit()
        return True, "회원가입이 완료됐어요. 로그인해 주세요."
    except sqlite3.IntegrityError:
        return False, "이미 사용 중인 아이디예요. 다른 아이디를 선택해 주세요."


def authenticate(username, password):
    with db_connect() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE username = ? COLLATE NOCASE",
            (username.strip(),),
        ).fetchone()
    if user and verify_password(password, user["salt"], user["password_hash"]):
        return dict(user)
    return None


init_db()

for key, default in {
    "page": "홈",
    "logged_in": False,
    "user_id": None,
    "username": "",
    "display_name": "",
    "role": "",
}.items():
    if key not in st.session_state:
        st.session_state[key] = default


def go(page):
    st.session_state.page = page


def render_sidebar():
    with st.sidebar:
        # 브랜드는 박스형 버튼이 아닌 로고 텍스트로 표현
        st.markdown(
            '<div class="brand-word">Event <span>ON</span></div>'
            '<div class="brand-sub">PLAN SMART. RUN BETTER.</div>',
            unsafe_allow_html=True,
        )
        st.write("")
        st.markdown('<div class="sidebar-label">WORKSPACE</div>', unsafe_allow_html=True)
        nav_items = [("⌂", "홈", "홈"), ("▦", "대시보드", "대시보드"), ("▤", "AI 보고서", "AI 보고서")]
        for icon, label, page in nav_items:
            active = st.session_state.page == page
            if st.button(f"{icon}   {label}", key=f"nav_{page}", use_container_width=True,
                         type="primary" if active else "secondary"):
                go(page)
                st.rerun()

        st.markdown('<div class="sidebar-label">PREFERENCES</div>', unsafe_allow_html=True)
        if st.button("⚙   설정", key="nav_settings", use_container_width=True,
                     type="primary" if st.session_state.page == "설정" else "secondary"):
            go("설정")
            st.rerun()

        st.markdown("<br>", unsafe_allow_html=True)
        st.divider()
        if st.session_state.logged_in:
            display_name = st.session_state.display_name or st.session_state.username
            st.markdown(
                f'<div class="sidebar-user"><div class="sidebar-user-name">● &nbsp; {display_name}님</div>'
                f'<div class="sidebar-user-role">{st.session_state.role}</div></div>',
                unsafe_allow_html=True,
            )
            if st.button("로그아웃", key="logout", use_container_width=True):
                for key, value in {
                    "logged_in": False, "user_id": None, "username": "",
                    "display_name": "", "role": "", "page": "홈"
                }.items():
                    st.session_state[key] = value
                st.rerun()
        else:
            st.markdown('<div class="sidebar-label">YOUR ACCOUNT</div>', unsafe_allow_html=True)
            if st.button("↗   로그인 / 회원가입", key="nav_login", use_container_width=True):
                go("로그인")
                st.rerun()


def render_home():
    st.markdown("""
    <div class="hero">
      <div class="eyebrow">AI EVENT PLANNING PLATFORM</div>
      <h1>좋은 행사는<br>좋은 설계에서 시작됩니다.</h1>
      <p>행사 기획부터 공간 운영까지, 필요한 작업을 한곳에서 관리하세요.
      Event ON은 더 체계적인 행사 준비를 위한 스마트 워크스페이스입니다.</p>
    </div>
    """, unsafe_allow_html=True)

    st.markdown('<h2 class="section-heading">무엇을 시작할까요?</h2>', unsafe_allow_html=True)
    st.caption("필요한 작업을 선택해 이동하세요.")
    left, right = st.columns(2, gap="large")
    with left:
        st.markdown("""
        <div class="feature-card">
          <div class="feature-icon">▦</div><h3>대시보드</h3>
          <p>행사 설계 및 공간 분석을 위한 작업 공간입니다. 대시보드 담당자의 코드를 여기에 연결합니다.</p>
        </div>""", unsafe_allow_html=True)
        if st.button("대시보드 열기  →", type="primary", use_container_width=True, key="home_dashboard"):
            go("대시보드"); st.rerun()
    with right:
        st.markdown("""
        <div class="feature-card">
          <div class="feature-icon">▤</div><h3>AI 보고서 다운로드</h3>
          <p>행사 설계 결과와 분석 내용을 보고서로 확인하고 내려받을 수 있도록 준비하는 공간입니다.</p>
        </div>""", unsafe_allow_html=True)
        if st.button("보고서 페이지 열기  →", use_container_width=True, key="home_report"):
            go("AI 보고서"); st.rerun()

    st.write("")
    st.markdown(
        '<div class="small-muted">대시보드와 보고서의 실제 기능은 담당 코드 연결 후 사용할 수 있습니다.</div>',
        unsafe_allow_html=True,
    )


def render_dashboard():
    st.markdown('<div class="eyebrow">WORKSPACE</div>', unsafe_allow_html=True)
    st.title("대시보드")
    st.caption("대시보드 담당자가 만든 기능을 연결할 영역입니다.")
    st.markdown("""
    <div class="placeholder">
      <div style="font-size:2.4rem">🧩</div><h3>대시보드 콘텐츠 영역</h3>
      <p>이곳에 행사 정보 입력, 공간 배치, 평면도 및 시뮬레이션 등<br>
      대시보드 담당자의 코드를 연결하면 됩니다.</p>
      <p class="small-muted">현재는 기능 충돌을 방지하기 위해 비워 두었습니다.</p>
    </div>""", unsafe_allow_html=True)


def render_report():
    st.markdown('<div class="eyebrow">REPORT CENTER</div>', unsafe_allow_html=True)
    st.title("AI 보고서 다운로드")
    st.caption("대시보드 결과를 보고서로 연결할 영역입니다.")
    st.markdown("""
    <div class="placeholder">
      <div style="font-size:2.4rem">📑</div><h3>보고서 콘텐츠 영역</h3>
      <p>행사 정보와 배치도, 동선 분석 결과 등을 PDF 보고서로 만드는 기능을<br>
      추후 이곳에 연결할 수 있습니다.</p>
      <p class="small-muted">아직 연결된 보고서가 없습니다.</p>
    </div>""", unsafe_allow_html=True)
    st.button("보고서 생성 기능 준비 중", disabled=True, use_container_width=True)


def render_auth():
    st.markdown('<div class="eyebrow">YOUR ACCOUNT</div>', unsafe_allow_html=True)
    st.title("계정")
    st.caption("아이디와 비밀번호로 계정을 만들고 로그인할 수 있어요.")
    login_tab, signup_tab = st.tabs(["로그인", "회원가입"])

    with login_tab:
        with st.form("login_form", clear_on_submit=False):
            username = st.text_input("아이디", key="login_username")
            password = st.text_input("비밀번호", type="password", key="login_password")
            submitted = st.form_submit_button("로그인", type="primary", use_container_width=True)
        if submitted:
            if not username.strip() or not password:
                st.error("아이디와 비밀번호를 모두 입력해 주세요.")
            else:
                user = authenticate(username, password)
                if user:
                    st.session_state.logged_in = True
                    st.session_state.user_id = user["id"]
                    st.session_state.username = user["username"]
                    st.session_state.display_name = user["display_name"]
                    st.session_state.role = user["role"]
                    st.session_state.page = "홈"
                    st.success("로그인했어요!")
                    st.rerun()
                else:
                    st.error("아이디 또는 비밀번호가 올바르지 않습니다.")

    with signup_tab:
        with st.form("signup_form", clear_on_submit=True):
            new_username = st.text_input("아이디", key="signup_username", help="3자 이상 권장")
            display_name = st.text_input("표시 이름", key="signup_display_name")
            role = st.selectbox("역할", ["기획자", "관리자", "팀원", "상사"], key="signup_role")
            password1 = st.text_input("비밀번호", type="password", key="signup_password")
            password2 = st.text_input("비밀번호 확인", type="password", key="signup_password_confirm")
            submitted_signup = st.form_submit_button("회원가입", type="primary", use_container_width=True)
        if submitted_signup:
            if not new_username.strip() or not display_name.strip() or not password1:
                st.error("아이디, 표시 이름, 비밀번호를 모두 입력해 주세요.")
            elif len(new_username.strip()) < 3:
                st.error("아이디는 3자 이상으로 입력해 주세요.")
            elif len(password1) < 8:
                st.error("비밀번호는 8자 이상으로 설정해 주세요.")
            elif password1 != password2:
                st.error("비밀번호가 서로 일치하지 않습니다.")
            else:
                ok, message = create_user(new_username, display_name, role, password1)
                if ok:
                    st.success(message)
                else:
                    st.error(message)


def render_settings():
    st.markdown('<div class="eyebrow">PREFERENCES</div>', unsafe_allow_html=True)
    st.title("설정")
    choices = [
        "계정 및 프로필", "보고서 설정", "화면 설정",
        "AI 분석 설정", "프로젝트 및 저장 관리", "보안 및 계정 관리"
    ]
    selected = st.radio("설정 항목", choices, horizontal=True, label_visibility="collapsed")
    descriptions = {
        "계정 및 프로필": "사용자 정보와 프로필 설정을 추가할 영역입니다.",
        "보고서 설정": "보고서 형식과 출력 옵션을 설정할 영역입니다.",
        "화면 설정": "테마와 화면 표시 방식을 설정할 영역입니다.",
        "AI 분석 설정": "분석 방식과 결과 표시 옵션을 설정할 영역입니다.",
        "프로젝트 및 저장 관리": "프로젝트 저장, 불러오기 및 관리 기능을 추가할 영역입니다.",
        "보안 및 계정 관리": "계정 보안과 접근 권한 관련 기능을 추가할 영역입니다."
    }
    st.divider()
    st.subheader(selected)
    st.info(descriptions[selected])


def main():
    render_sidebar()
    page = st.session_state.page
    if page == "홈":
        render_home()
    elif page == "대시보드":
        render_dashboard()
    elif page == "AI 보고서":
        render_report()
    elif page == "로그인":
        render_auth()
    elif page == "설정":
        render_settings()
    else:
        render_home()


if __name__ == "__main__":
    main()

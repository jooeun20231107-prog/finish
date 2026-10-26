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

def build_report_text(d, settings):
    lines = [
        f"# {d.get('event_name') or '행사 운영 계획'}",
        f"**생성일:** {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "## 1. 행사 개요",
        f"- 행사 유형: {d.get('event_type','미입력')}",
        f"- 목적: {d.get('purpose','미입력')}",
        f"- 장소: {d.get('venue','미정')}",
        f"- 일정: {d.get('date','미정')} / {d.get('hours','미정')}",
        f"- 예상 방문객: {d.get('visitors',0):,}명",
        f"- 예산: {d.get('budget','미정')}",
        f"- 대상 연령: {d.get('audience','전 연령')}",
        f"- 분위기: {d.get('mood','전문적인')}",
        "",
        "## 2. 운영 계획",
        f"- 입장 및 안내: 입구와 안내 데스크를 눈에 잘 띄는 위치에 배치하고, 입장·퇴장 흐름이 교차하지 않도록 운영합니다.",
        f"- 공간 운영: {d.get('facilities','안내센터, 휴게공간')}를 중심으로 방문객 동선과 운영 인력의 이동 경로를 분리합니다.",
        f"- 인력 운영: 행사 시작 전 담당자별 역할, 비상 연락망, 교대 시간을 공유합니다.",
        f"- 접근성: 통로와 출입구를 확보하고, 이동 약자를 위한 접근 가능한 경로와 안내 표지를 마련합니다.",
        "",
        "## 3. 주요 권장 사항",
        "- 입구, 인기 프로그램, 푸드존 등 방문객이 몰릴 수 있는 지점에는 대기 공간을 확보합니다.",
        "- 안내 표지는 입장 전·분기점·시설 입구에 반복 배치하고, 글자 크기와 대비를 충분히 확보합니다.",
        "- 행사 시작 전 동선 리허설과 시설 점검을 진행하고, 변경 사항은 모든 운영 인력에게 동시에 전달합니다.",
    ]
    if settings.get("include_recommendations", True):
        lines += ["", "## 4. 운영 개선 제안",
                  "- 방문객이 집중되는 시간대를 예상해 입장 안내 인력과 현장 대응 담당자를 탄력적으로 배치합니다.",
                  "- QR 안내 또는 온라인 안내 페이지를 활용해 반복 문의를 줄이고 현장 안내 인력의 부담을 낮춥니다.",
                  "- 종료 직후 방문객 수, 대기 시간, 문의 유형을 기록해 다음 행사 운영 개선에 활용합니다."]
    if settings.get("include_risks", True):
        lines += ["", "## 5. 위험 요소 및 대응",
                  "- 혼잡: 입구와 주요 통로에 담당자를 배치하고, 통로를 막는 대기 줄이 생기지 않도록 관리합니다.",
                  "- 응급 상황: 응급 대응 담당자와 의료 지원 위치를 사전에 공유하고 비상 연락 체계를 확인합니다.",
                  "- 일정 지연: 프로그램별 준비 완료 시간을 정하고, 지연 시 안내 문구와 대체 진행안을 마련합니다.",
                  "- 장비 문제: 음향·전력·네트워크 장비를 사전 점검하고 주요 장비의 대체 수단을 준비합니다."]
    lines += ["", "## 6. 행사 당일 체크리스트",
              "- [ ] 출입구·비상구·통로 확보", "- [ ] 안내 표지 및 접수 장비 점검",
              "- [ ] 운영 인력 배치와 연락망 공유", "- [ ] 응급 대응 및 비상 대피 절차 확인",
              "- [ ] 프로그램 시작 전 음향·전력·시설 점검", "- [ ] 종료 후 현장 정리 및 결과 기록",
              "", "---", "본 보고서는 입력된 행사 정보를 바탕으로 생성된 기획 초안입니다. 현장 여건과 관계 법령·시설 안전 기준에 맞춰 최종 검토해야 합니다."]
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
        st.session_state.report_text=build_report_text(data,settings)
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
                st.success("보고서 설정을 저장했어요." if st.session_state.logged_in else "설정은 로그인한 계정에만 저장됩니다.")

    with tabs[2]:
        st.subheader("화면 설정")
        with st.form("screen_settings_form"):
            theme=st.selectbox("테마",["라이트","다크"],index=["라이트","다크"].index(settings.get("theme","라이트")))
            compact=st.checkbox("간격을 좁게 표시",value=settings.get("compact",False))
            if st.form_submit_button("화면 설정 저장",type="primary"):
                settings.update({"theme":theme,"compact":compact}); save_settings(st.session_state.user_id,settings)
                st.success("화면 설정을 저장했어요. 테마 적용은 일부 컴포넌트에서 추가 조정이 필요할 수 있습니다." if st.session_state.logged_in else "화면 설정은 로그인한 계정에만 저장됩니다.")

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
                st.success("AI 분석 설정을 저장했어요." if st.session_state.logged_in else "AI 분석 설정은 로그인한 계정에만 저장됩니다.")

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
            role=st.selectbox("역할",["기획자","관리자","팀원","상사"])
            pw1=st.text_input("비밀번호 (8자 이상)",type="password")
            pw2=st.text_input("비밀번호 확인",type="password")
            submitted=st.form_submit_button("회원가입",type="primary",use_container_width=True)
        if submitted:
            if not username.strip() or not display.strip() or not pw1: st.error("모든 항목을 입력해 주세요.")
            elif len(username.strip())<3: st.error("아이디는 3자 이상이어야 합니다.")
            elif len(pw1)<8: st.error("비밀번호는 8자 이상이어야 합니다.")
            elif pw1!=pw2: st.error("비밀번호가 일치하지 않습니다.")
            else:
                ok,msg=create_user(username,display,role,pw1)
                (st.success if ok else st.error)(msg)

if __name__=="__main__":
    main()

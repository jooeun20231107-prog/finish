import streamlit as st

st.set_page_config(page_title="Event ON", page_icon="🎪", layout="wide", initial_sidebar_state="expanded")

st.markdown("""
<style>
.stApp{background:#f7f9fc}
[data-testid="stSidebar"]{background:#fff;border-right:1px solid #e7ebf2}
.block-container{padding-top:1.8rem;max-width:1440px}
.brand{font-size:1.55rem;font-weight:800;color:#315be8}
.hero{background:linear-gradient(135deg,#fff 0%,#eef4ff 100%);border:1px solid #e4ebfb;border-radius:24px;padding:2.5rem;margin-bottom:1.4rem}
.hero h1{font-size:clamp(2rem,4vw,3.2rem);line-height:1.15;color:#172b4d}
.hero p{font-size:1.05rem;color:#52627a;line-height:1.8}
.card{background:#fff;border:1px solid #e6eaf2;border-radius:20px;padding:1.5rem;min-height:160px}
.card h3{color:#1d2d50}
.card p{color:#697891;line-height:1.7}
.placeholder{border:1.5px dashed #cbd5e1;border-radius:18px;background:#fff;min-height:300px;padding:2.2rem;text-align:center;display:flex;flex-direction:column;justify-content:center}
.placeholder h3{color:#344563}.placeholder p{color:#718096;line-height:1.7}
div.stButton>button{border-radius:11px;min-height:2.8rem;font-weight:700;border:1px solid #d9e2f2}
div.stButton>button[kind="primary"]{background:#315be8;border-color:#315be8;color:#fff}
</style>
""", unsafe_allow_html=True)

if "page" not in st.session_state:
    st.session_state.page = "홈"

def go(page):
    st.session_state.page = page

with st.sidebar:
    if st.button("Event ON", use_container_width=True, key="brand"):
        go("홈"); st.rerun()
    st.caption("AI EVENT PLANNING PLATFORM")
    st.divider()
    for label, page in [("🏠  홈","홈"),("📊  대시보드","대시보드"),("📄  AI 보고서 다운로드","AI 보고서")]:
        if st.button(label, use_container_width=True, key="nav_"+page):
            go(page); st.rerun()
    st.divider()
    if st.button("⚙️  설정", use_container_width=True, key="nav_settings"):
        go("설정"); st.rerun()
    st.divider()
    st.caption("사용자 영역")
    if st.button("로그인 / 회원가입", use_container_width=True, key="nav_login"):
        go("로그인"); st.rerun()

page = st.session_state.page

if page == "홈":
    st.markdown("""
    <div class="hero">
      <div style="color:#4263eb;font-size:.8rem;font-weight:800;letter-spacing:.12em">AI EVENT PLANNING PLATFORM</div>
      <h1>행사 기획을 더 쉽고,<br>공간 설계를 더 똑똑하게.</h1>
      <p>Event ON은 행사 정보를 바탕으로 효율적인 행사 운영을 돕는 통합 플랫폼입니다.
      대시보드에서 행사 설계 작업을 진행하고, AI 보고서 페이지에서 결과물을 확인할 수 있습니다.</p>
    </div>
    """, unsafe_allow_html=True)
    st.subheader("시작하기")
    st.caption("원하는 작업을 선택해 시작하세요.")
    col1, col2 = st.columns(2, gap="large")
    with col1:
        st.markdown('<div class="card"><div style="font-size:1.8rem">📊</div><h3>대시보드</h3><p>행사 설계 기능을 연결할 작업 영역입니다. 현재는 대시보드 담당자의 코드를 넣을 수 있도록 비워 두었습니다.</p></div>', unsafe_allow_html=True)
        if st.button("대시보드 열기 →", type="primary", use_container_width=True, key="home_dash"):
            go("대시보드"); st.rerun()
    with col2:
        st.markdown('<div class="card"><div style="font-size:1.8rem">📄</div><h3>AI 보고서 다운로드</h3><p>대시보드 결과를 보고서로 연결할 영역입니다. 추후 실제 보고서 생성 및 다운로드 기능을 추가할 수 있습니다.</p></div>', unsafe_allow_html=True)
        if st.button("AI 보고서 페이지 열기 →", use_container_width=True, key="home_report"):
            go("AI 보고서"); st.rerun()
    st.info("대시보드와 보고서의 실제 기능은 별도 코드와 연결한 뒤 활성화됩니다.")

elif page == "대시보드":
    st.caption("WORKSPACE")
    st.title("대시보드")
    st.markdown("""
    <div class="placeholder">
      <div style="font-size:2.4rem">🧩</div>
      <h3>대시보드 콘텐츠 영역</h3>
      <p>이곳에 다른 개발자의 행사 정보 입력, 자동 공간 배치, 2D 평면도, 3D 조감도,<br>
      방문객 이동 시뮬레이션 코드를 연결하면 됩니다.</p>
      <p><small>현재는 의도적으로 기능을 구현하지 않았습니다.</small></p>
    </div>
    """, unsafe_allow_html=True)

elif page == "AI 보고서":
    st.caption("REPORT CENTER")
    st.title("AI 보고서 다운로드")
    st.markdown("""
    <div class="placeholder">
      <div style="font-size:2.4rem">📑</div>
      <h3>보고서 콘텐츠 영역</h3>
      <p>대시보드에서 생성한 행사 정보, 시설 배치도, 동선 분석 결과를<br>
      PDF 보고서로 변환하고 다운로드하는 기능을 이곳에 연결할 수 있습니다.</p>
      <p><small>아직 대시보드와 연결되지 않아 다운로드할 보고서는 없습니다.</small></p>
    </div>
    """, unsafe_allow_html=True)
    st.button("보고서 기능 준비 중", disabled=True, use_container_width=True)

elif page == "로그인":
    st.caption("ACCOUNT")
    st.title("로그인 / 회원가입")
    st.caption("현재는 화면 틀만 준비되어 있으며 실제 인증 기능은 연결되지 않았습니다.")
    tab1, tab2 = st.tabs(["로그인", "회원가입"])
    with tab1:
        with st.form("login_form"):
            st.text_input("아이디")
            st.text_input("비밀번호", type="password")
            st.form_submit_button("로그인", use_container_width=True)
        st.info("실제 계정 인증 기능은 추후 연결해야 합니다.")
    with tab2:
        with st.form("signup_form"):
            st.text_input("사용할 아이디")
            st.text_input("표시 이름")
            st.selectbox("역할", ["기획자", "관리자", "팀원", "상사"])
            st.text_input("비밀번호", type="password")
            st.text_input("비밀번호 확인", type="password")
            st.form_submit_button("회원가입", use_container_width=True)
        st.info("실제 회원가입 및 계정 저장 기능은 추후 연결해야 합니다.")

elif page == "설정":
    st.caption("PREFERENCES")
    st.title("설정")
    selected = st.radio("설정 항목", [
        "계정 및 프로필", "보고서 설정", "화면 설정",
        "AI 분석 설정", "프로젝트 및 저장 관리", "보안 및 계정 관리"
    ], horizontal=True, label_visibility="collapsed")
    st.divider()
    st.subheader(selected)
    descriptions = {
        "계정 및 프로필": "사용자 이름, 역할, 부서 및 프로필 설정을 추가할 영역입니다.",
        "보고서 설정": "보고서 형식, 페이지 구성, 기본 출력 옵션을 설정할 영역입니다.",
        "화면 설정": "테마와 화면 표시 방식을 설정할 영역입니다.",
        "AI 분석 설정": "분석 방식과 결과 표시 옵션을 설정할 영역입니다.",
        "프로젝트 및 저장 관리": "프로젝트 저장, 불러오기 및 관리 기능을 추가할 영역입니다.",
        "보안 및 계정 관리": "계정 보안과 접근 권한 관련 기능을 추가할 영역입니다."
    }
    st.info(descriptions[selected])
    st.caption("설정은 현재 메뉴와 페이지 구조만 준비되어 있습니다.")

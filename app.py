"""Event ON homepage. Dashboard and reports are extension points, not active features."""
import streamlit as st
import streamlit.components.v1 as components

st.set_page_config(page_title="Event ON",page_icon="🎪",layout="wide",initial_sidebar_state="expanded")
st.markdown("""<style>
.stApp{background:#fff;color:#14243d}
.block-container{max-width:1300px;padding-top:2rem;padding-bottom:2rem}
[data-testid="stSidebar"]{background:#fff;border-right:1px solid #e5edf8}
[data-testid="stSidebar"] [data-testid="stSidebarUserContent"]{min-height:calc(100dvh - 5rem);display:flex;flex-direction:column}
[data-testid="stSidebar"] [data-testid="stSidebarUserContent"]>div{flex:1;display:flex;flex-direction:column}
[data-testid="stSidebar"] [data-testid="stVerticalBlock"]:first-child{flex:1}
[data-testid="stSidebar"] [data-testid="stVerticalBlockBorderWrapper"]:has(.account-anchor){margin-top:auto}
[data-testid="stSidebar"] [data-testid="stVerticalBlock"]>div:has(.account-anchor){margin-top:auto}
div.stButton>button{border-radius:10px;min-height:46px;font-weight:600}
.account-name{padding:12px 8px;color:#425571;font-size:14px;border-top:1px solid #e7edf6;margin-top:8px}
.home-kicker{color:#2563eb;font-size:12px;font-weight:750;letter-spacing:2px}
</style>""",unsafe_allow_html=True)
HOME_HTML = '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Event ON — 행사 기획의 새로운 시작</title><style>\n*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:#14243d;background:#fff;font-family:system-ui,\'Apple SD Gothic Neo\',\'Nanum Gothic\',sans-serif}a{color:inherit;text-decoration:none}.wrap{max-width:1160px;margin:auto;padding:0 28px}header{border-bottom:1px solid #eaf0f7;background:white}nav{height:82px;display:flex;align-items:center;justify-content:space-between;gap:24px}.logo{font-size:26px;font-weight:850;letter-spacing:-1px}.on{color:#2563eb}.links{display:flex;align-items:center;gap:28px;font-size:14px;color:#4b5d76}.button{display:inline-block;border-radius:10px;background:#2563eb;color:white;padding:14px 23px;font-size:15px;font-weight:700}.mini{padding:10px 17px}.hero{background:radial-gradient(ellipse at 80% 30%,#e6f1ff,transparent 60%),linear-gradient(180deg,#f8fbff,#fff);padding:80px 0 66px}.hero-grid{display:grid;grid-template-columns:1.06fr 1fr;align-items:center;gap:50px}.eyebrow{display:inline-block;color:#245bb1;font-size:12px;font-weight:750;letter-spacing:1.2px;background:#eaf2ff;border:1px solid #d7e6ff;border-radius:99px;padding:8px 13px}h1{font-size:clamp(38px,4.5vw,57px);letter-spacing:-2.8px;line-height:1.22;margin:24px 0}h1 span{color:#2563eb}.lead{font-size:17px;color:#52647c;line-height:1.9;max-width:480px}.hero .button{margin-top:17px}.caption{font-size:12px;color:#60718a;line-height:1.7;margin-top:14px}.preview{border:1px solid #dbe6f4;border-radius:20px;background:white;box-shadow:0 22px 65px #244e9214;overflow:hidden;transform:rotate(-2deg)}.preview-head{display:flex;justify-content:space-between;align-items:center;padding:18px 20px;border-bottom:1px solid #edf1f7;font-size:13px;font-weight:700}.badge{font-size:10px;color:#385b89;background:#f0f5fc;padding:5px 8px;border-radius:20px}.map{margin:20px;padding:20px;background-color:#f8fbff;background-image:linear-gradient(#e9eff8 1px,transparent 1px),linear-gradient(90deg,#e9eff8 1px,transparent 1px);background-size:20px 20px;border:1px solid #dce6f4;border-radius:12px}.map-label{font-size:10px;color:#60718a;text-align:right;margin-bottom:12px}.blocks{display:grid;grid-template-columns:1fr 1.4fr 1fr;gap:26px 20px;align-items:stretch}.facility{border-radius:7px;min-height:65px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:750;border:1px solid #c9dcff;background:#dfebff;color:#254f99}.stage{grid-column:1/4;background:#e9e2ff;color:#624599;border-color:#d6c9f6;min-height:58px}.food{background:#fff0d3;border-color:#f4dbac;color:#8b5917}.rest{background:#dff4ea;border-color:#bde4d0;color:#23664c}.medical{background:#ffe4e6;border-color:#f5c8cc;color:#9d3648}.gate{grid-column:1/4;text-align:center;color:#3565a5;font-size:11px;font-weight:700;letter-spacing:2px}.legend{display:flex;gap:14px;flex-wrap:wrap;padding:0 20px 19px;font-size:10px;color:#5a6d87}.legend span:before{content:\'\';display:inline-block;width:7px;height:7px;border-radius:2px;background:#8db4fa;margin-right:5px}.types{border-top:1px solid #edf2f8;border-bottom:1px solid #edf2f8;padding:23px 0}.types .wrap{display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;font-size:13px;color:#61728a}.types strong{color:#253a59}section.content{padding:78px 0}.section-tag{color:#2563eb;font-size:12px;font-weight:800;letter-spacing:1.5px}h2{font-size:34px;letter-spacing:-1.5px;margin:14px 0 16px;line-height:1.35}.intro{color:#61728a;font-size:15px;line-height:1.8}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:34px}.card{border:1px solid #e2eaf4;border-radius:16px;padding:28px;background:white}.icon{height:42px;width:42px;display:grid;place-items:center;border-radius:12px;background:#edf4ff;color:#2563eb;font-size:18px;font-weight:800}.card h3{font-size:19px;letter-spacing:-.6px;margin:22px 0 12px}.card p{font-size:14px;color:#5d6f86;line-height:1.9;margin:0}.workflow{background:#f7faff}.step{font-size:12px;color:#2563eb;font-weight:800;margin-bottom:18px}.notice{color:#63758d;font-size:12px;line-height:1.8;margin-top:22px}.cta{background:#eef5ff;border:1px solid #dbe8fc;border-radius:22px;padding:46px;text-align:center}.cta h2{margin-top:0}.cta p{color:#536984;line-height:1.8}.cta .button{margin-top:10px}footer{border-top:1px solid #edf1f7;padding:30px 0}.foot{display:flex;justify-content:space-between;align-items:center;gap:20px;font-size:12px;color:#60718a}.foot .logo{font-size:20px}a:focus-visible{outline:3px solid #f59e0b;outline-offset:4px}@media(max-width:780px){nav{height:70px}.links>a:not(.button){display:none}.hero{padding:42px 0}.hero-grid{grid-template-columns:1fr;gap:38px}.preview{transform:none}h1{letter-spacing:-1.8px}.cards{grid-template-columns:1fr}.wrap{padding:0 22px}section.content{padding:54px 0}h2{font-size:28px}.cta{padding:32px 22px}.foot{align-items:flex-start;flex-direction:column}.types .wrap{justify-content:flex-start}}\n</style></head><body>\n<header><nav class="wrap" aria-label="주요 메뉴"><a class="logo" href="#">Event <span class="on">ON.</span></a><div class="links"><a href="#features">서비스 소개</a><a href="#workflow">이용 방법</a><a class="button mini" href="#start">시작하기 ↗</a></div></nav></header>\n<main><section class="hero"><div class="wrap hero-grid"><div><div class="eyebrow">AI-POWERED EVENT PLANNING</div><h1>생각 속의 행사,<br><span>공간으로 켜지다.</span></h1><p class="lead">복잡한 행사 준비의 시작을 더 간단하게.<br>행사 정보에서 공간 배치와 방문객 동선까지,<br>Event ON이 새로운 기획 경험을 준비합니다.</p><a class="button" href="#start">행사 기획 시작하기 ↗</a><p class="caption">AI 기반 행사 자동 설계 플랫폼 · 현재 홈페이지 공개 단계</p></div><div class="preview" role="img" aria-label="계획된 설계 화면을 설명하는 예시. 공연장, 체험부스, 푸드존, 휴게공간, 의료센터와 출입구로 구성됨"><div class="preview-head"><span>나의 행사 공간</span><span class="badge">컨셉 미리보기</span></div><div class="map"><div class="map-label">N ↑ · 예시 배치</div><div class="blocks"><div class="facility stage">공연장 / STAGE</div><div class="facility">체험 부스 A</div><div class="facility rest">휴게 공간</div><div class="facility food">푸드존</div><div class="facility">체험 부스 B</div><div class="facility">안내센터</div><div class="facility medical">응급의료센터</div><div class="gate">↑ 입구\u3000 ·\u3000 주요 통로\u3000 ·\u3000 출구 ↓</div></div></div><div class="legend"><span>체험·안내</span><span>공연</span><span>휴식</span><span>식음료</span></div></div></div></section>\n<div class="types"><div class="wrap"><strong>다양한 행사의 시작을 함께</strong><span>지역 축제</span><span>박람회·전시</span><span>공연·페스티벌</span><span>체험·팝업 행사</span></div></div>\n<section class="content" id="features"><div class="wrap"><div class="section-tag">DESIGN YOUR EVENT</div><h2>기획에 집중하세요.<br>공간 설계는 더 직관적으로.</h2><p class="intro">흩어진 행사 준비 과정을 하나의 흐름으로 연결하는 플랫폼을 만듭니다.</p><div class="cards"><article class="card"><div class="icon">01</div><h3>선택으로 시작하는 기획</h3><p>행사 목적, 예상 방문객, 필요한 시설을 선택해 기획의 기본 조건을 한눈에 정리합니다.</p></article><article class="card"><div class="icon">02</div><h3>한눈에 이해하는 공간</h3><p>2D 평면도와 3D 조감도를 연결해 시설 배치와 주요 통로를 직관적으로 살펴봅니다.</p></article><article class="card"><div class="icon">03</div><h3>흐름까지 생각한 설계</h3><p>방문객 이동과 예상 혼잡을 비교하며, 행사 목적에 맞는 공간 구성안을 검토합니다.</p></article></div><p class="notice">위 내용은 연결 예정인 대시보드의 서비스 방향입니다. 현재 홈페이지에서는 자동 배치·시뮬레이션을 실행하지 않습니다.</p></div></section>\n<section class="content workflow" id="workflow"><div class="wrap"><div class="section-tag">HOW IT WORKS</div><h2>아이디어에서 행사장까지, 세 단계.</h2><div class="cards"><article class="card"><div class="step">STEP 01</div><h3>행사 정보 입력</h3><p>어떤 행사인지, 누가 방문하는지, 어떤 공간이 필요한지 선택합니다.</p></article><article class="card"><div class="step">STEP 02</div><h3>공간과 동선 검토</h3><p>시설 배치안과 이동 흐름을 함께 살펴보고 원하는 방향으로 조정합니다.</p></article><article class="card"><div class="step">STEP 03</div><h3>배치안 선택 및 저장</h3><p>행사에 맞는 설계안을 선택하고, 프로젝트를 저장해 이어서 기획합니다.</p></article></div></div></section>\n<section class="content" id="start"><div class="wrap"><div class="cta"><div class="section-tag">YOUR NEXT EVENT STARTS HERE</div><h2>다음 행사의 가능성을 켜보세요.</h2><p>더 쉽고 명확한 행사 설계 경험을 준비하고 있습니다.<br>대시보드는 추후 이 홈페이지와 연결될 예정입니다.</p><a class="button" href="#features">Event ON 알아보기 ↑</a><p class="notice">현재는 서비스 소개 페이지입니다. 회원가입이나 행사 데이터 수집은 하지 않습니다.</p></div></div></section>\n</main><footer><div class="wrap foot"><a href="#" class="logo">Event <span class="on">ON.</span></a><span>행사 기획의 새로운 시작</span><span>© Event ON. All rights reserved.</span></div></footer></body></html>'

def navigate(page):
    st.session_state.page=page

# Replace these two functions with your dashboard / AI report implementations.
def render_dashboard():
    import json
    from datetime import date, time
    st.caption('EVENT ON / PROJECT SETUP')
    st.title('어떤 행사를 준비하고 있나요?')
    st.write('행사 조건과 원하는 부스를 입력하세요. 입력 결과는 나중에 자동 배치 엔진에 연결할 수 있습니다.')
    st.info('현재는 입력·검증·JSON 저장 단계입니다. 자동 배치와 혼잡 분석은 실행되지 않습니다.')
    with st.form('event_spec_form'):
        st.subheader('01 · 행사 기본 정보')
        name=st.text_input('행사명 *',placeholder='예: 우리 동네 봄 축제',key='spec_name')
        a,b=st.columns(2)
        purpose=a.selectbox('행사 목적',['지역 교류','문화·예술 향유','제품·브랜드 홍보','교육·체험','판매·수익','네트워킹','직접 입력'],key='spec_purpose')
        custom_purpose=b.text_input('목적 상세 / 직접 입력',key='spec_purpose_detail')
        types=st.multiselect('행사 유형 · 복수 선택 *',['축제','박람회·전시','공연','체험 행사','팝업스토어','컨퍼런스','플리마켓','스포츠 행사','기타'],key='spec_types')
        a,b=st.columns(2)
        budget=a.number_input('예산 (만원)',min_value=0,value=1000,step=100,key='spec_budget')
        visitors=b.number_input('예상 총 방문객 (명)',min_value=1,value=500,step=50,key='spec_visitors')
        st.caption('총 방문객과 최대 동시 체류 인원은 다릅니다. 동선 설계에는 동시 체류 인원을 별도로 사용하세요.')
        concurrent=st.number_input('예상 최대 동시 체류 인원 (명)',min_value=1,value=200,step=10,key='spec_concurrent')
        st.subheader('02 · 행사 공간')
        a,b=st.columns(2)
        venue=a.selectbox('행사 장소 유형',['야외 광장','공원','운동장','실내 전시장','강당·체육관','복합 공간','기타'],key='spec_venue')
        environment=b.selectbox('실내·외',['야외','실내','실내·외 혼합'],key='spec_environment')
        shape=st.selectbox('행사장 모형',['직사각형','정사각형','원형','타원형','L자형','비정형·추후 도면 지정'],key='spec_shape')
        location=st.text_input('행사장 위치',placeholder='예: 서울시 ○○구 ○○공원 (주소 또는 장소명)',key='spec_location')
        a,b,c=st.columns(3)
        area=a.number_input('사용 가능 면적 (m²) *',min_value=1.0,value=1000.0,step=10.0,key='spec_area')
        entrances=b.number_input('입구 수',min_value=1,max_value=30,value=1,key='spec_entrances')
        exits=c.number_input('출구 수',min_value=1,max_value=30,value=1,key='spec_exits')
        st.caption('면적은 시설·통로가 사용할 수 있는 순면적입니다. 입출구 위치와 비정형 외곽은 추후 도면 편집에서 지정합니다.')
        st.subheader('03 · 운영과 방문객')
        a,b=st.columns(2)
        start_date=a.date_input('시작일',value=date.today(),key='spec_start_date')
        end_date=b.date_input('종료일',value=date.today(),key='spec_end_date')
        start_time=a.time_input('시작 시각',value=time(10,0),key='spec_start_time')
        end_time=b.time_input('종료 시각',value=time(18,0),key='spec_end_time')
        moods=st.multiselect('원하는 분위기',['활기찬','차분한','가족 친화적','감성적인','미래지향적','자연 친화적','고급스러운'],default=['가족 친화적'],key='spec_moods')
        all_ages=st.checkbox('전 연령층 대상',value=True,key='spec_all_ages')
        ages=st.multiselect('주요 연령층 · 전 연령층 해제 시 적용',['영유아·어린이','청소년','20~30대','40~50대','60대 이상'],key='spec_ages')
        st.subheader('04 · 배치 조건')
        a,b=st.columns(2)
        candidates=a.slider('탐색할 배치안 수',min_value=3,max_value=30,value=6,key='spec_candidates')
        priority=b.selectbox('우선 고려할 항목',['동선 균형','혼잡 분산','응급 접근성','부스 수용','휴식 공간'],key='spec_priority')
        aisle=st.number_input('희망 주요 통로 폭 (m)',min_value=1.0,max_value=20.0,value=3.0,step=0.5,key='spec_aisle')
        st.caption('통로 폭은 기획 희망값이며 법규·피난·접근성 기준을 검증한 값이 아닙니다.')
        support=st.multiselect('추가로 필요한 공용시설',['안내센터','응급의료센터','화장실','휴게공간','수유실','쓰레기 수거장','운영본부','휠체어 접근 동선'],default=['안내센터','응급의료센터','휴게공간'],key='spec_support')
        st.subheader('05 · 원하는 부스 직접 입력')
        st.write('가로·세로 단위는 미터(m)입니다. 같은 부스가 여러 개라면 개수를 입력하세요. 마지막 행에서 새 부스를 추가할 수 있습니다.')
        rows=st.data_editor([
            {'부스 이름':'체험 부스','종류':'체험','가로(m)':3.0,'세로(m)':3.0,'개수':4},
            {'부스 이름':'푸드 부스','종류':'식음료','가로(m)':4.0,'세로(m)':3.0,'개수':2},
        ],num_rows='dynamic',hide_index=True,use_container_width=True,key='spec_booths',column_config={
            '부스 이름':st.column_config.TextColumn(required=True),
            '종류':st.column_config.SelectboxColumn(options=['체험','식음료','판매','전시','공연','운영','휴식','기타'],required=True),
            '가로(m)':st.column_config.NumberColumn(min_value=0.5,max_value=1000.0,step=0.5,required=True),
            '세로(m)':st.column_config.NumberColumn(min_value=0.5,max_value=1000.0,step=0.5,required=True),
            '개수':st.column_config.NumberColumn(min_value=1,max_value=500,step=1,required=True),
        })
        requests=st.text_area('추가 요청 / 고정 장애물',placeholder='예: 무대는 북쪽, 나무 위치 보존, 유모차 이동 공간 확보',key='spec_requests')
        submitted=st.form_submit_button('입력 검토 및 기획안 저장',type='primary',use_container_width=True)
    if submitted:
        from datetime import datetime
        errors=[]
        if not name.strip(): errors.append('행사명을 입력하세요.')
        if not types: errors.append('행사 유형을 하나 이상 선택하세요.')
        if purpose=='직접 입력' and not custom_purpose.strip(): errors.append('행사 목적을 직접 입력하세요.')
        if not all_ages and not ages: errors.append('주요 연령층을 선택하거나 전 연령층을 체크하세요.')
        if datetime.combine(end_date,end_time)<=datetime.combine(start_date,start_time): errors.append('종료 일시는 시작 일시보다 늦어야 합니다. 자정을 넘기면 종료일도 변경하세요.')
        if concurrent>visitors: errors.append('동시 체류 인원은 총 방문객 수 이하로 입력하세요.')
        booths=[]
        import math
        for i,row in enumerate(rows,1):
            try:
                w=float(row['가로(m)']);h=float(row['세로(m)']);n=float(row['개수'])
                if not str(row.get('부스 이름') or '').strip() or row.get('종류') not in ['체험','식음료','판매','전시','공연','운영','휴식','기타'] or not all(math.isfinite(x) for x in [w,h,n]) or min(w,h)<0.5 or n<1 or not n.is_integer(): raise ValueError()
                booths.append({'name':row['부스 이름'].strip(),'type':row['종류'],'width_m':w,'depth_m':h,'count':int(n)})
            except (ValueError,TypeError,KeyError): errors.append(f'부스 {i}행의 이름·종류·가로·세로·개수를 확인하세요.')
        footprint=sum(z['width_m']*z['depth_m']*z['count'] for z in booths)
        if footprint>=area: errors.append('부스 바닥면적 합계가 전체 면적 이상입니다. 통로와 공용시설 공간도 필요합니다.')
        if errors:
            for error in errors: st.error(error)
        else:
            st.session_state.event_spec={'schema_version':1,'name':name.strip(),'purpose':purpose,'purpose_detail':custom_purpose,'event_types':types,'budget_10k_krw':budget,'total_visitors':visitors,'peak_concurrent_visitors':concurrent,'venue_type':venue,'environment':environment,'shape':shape,'location':location,'usable_area_m2':area,'entrance_count':entrances,'exit_count':exits,'start':datetime.combine(start_date,start_time).isoformat(),'end':datetime.combine(end_date,end_time).isoformat(),'moods':moods,'age_groups':['전 연령층'] if all_ages else ages,'candidate_count':candidates,'priority':priority,'preferred_aisle_width_m':aisle,'support_facilities':support,'booths':booths,'booth_footprint_m2':footprint,'requests':requests}
            st.success('입력 검토 완료! 현재 세션에 저장했습니다. 계속 보관하려면 아래 JSON을 다운로드하세요.')
    if 'event_spec' in st.session_state:
        spec=st.session_state.event_spec
        st.divider();st.subheader('마지막으로 저장한 기획안')
        st.caption('아래 요약은 저장 버튼을 누른 시점의 값입니다. 수정 후에는 다시 저장하세요.')
        a,b,c=st.columns(3)
        a.metric('행사',spec['name']);b.metric('부스 수',sum(x['count'] for x in spec['booths']));c.metric('부스 점유면적',f"{spec['booth_footprint_m2']:,.1f} m²")
        st.caption('점유면적에는 통로·대기공간·공용시설이 포함되지 않습니다. 실제 배치 가능 여부는 아직 검증하지 않았습니다.')
        st.download_button('기획안 JSON 다운로드',json.dumps(spec,ensure_ascii=False,indent=2),file_name='event_on_project.json',mime='application/json')
        with st.expander('저장 내용 확인'): st.json(spec)


def render_ai_report():
    st.title("AI 보고서")
    st.info("AI 보고서 연결 준비 중입니다. render_ai_report()에 보고서 코드를 추가하세요.")
    st.button("← 홈으로",on_click=navigate,args=("home",),key="report_back")

def render_settings():
    st.title("설정")
    st.caption("사용자 이름은 현재 브라우저 세션에서만 유지됩니다. 로그인 기능은 아직 연결하지 않았습니다.")
    with st.form("profile"):
        name=st.text_input("사용자 이름",value=st.session_state.display_name,max_chars=40)
        if st.form_submit_button("저장",type="primary"):
            if name.strip():
                st.session_state.display_name=name.strip()
                st.session_state.profile_saved=True
                st.rerun()
            else: st.error("사용자 이름을 입력해 주세요.")
    if st.session_state.pop("profile_saved",False):st.success("사용자 이름을 변경했습니다.")
    st.button("← 홈으로",on_click=navigate,args=("home",),key="settings_back")

def render_home():
    st.markdown('<div class="home-kicker">EVENT ON · WORKSPACE</div>',unsafe_allow_html=True)
    st.subheader("어떤 작업을 시작할까요?")
    left,right=st.columns(2)
    with left:
        st.button("▦  대시보드",type="primary",use_container_width=True,on_click=navigate,args=("dashboard",),key="home_dashboard")
        st.caption("행사 공간과 동선 설계 · 추후 연결")
    with right:
        st.button("✦  AI 보고서",use_container_width=True,on_click=navigate,args=("report",),key="home_report")
        st.caption("행사 기획 보고서 · 추후 연결")
    components.html(HOME_HTML,height=1900,scrolling=True)

st.session_state.setdefault("page","home")
st.session_state.setdefault("display_name","사용자")
with st.sidebar:
    st.markdown("## Event :blue[ON.]")
    st.caption("행사 기획의 새로운 시작")
    st.button("⌂  홈",use_container_width=True,on_click=navigate,args=("home",),key="side_home")
    st.button("▦  대시보드",use_container_width=True,on_click=navigate,args=("dashboard",),key="side_dashboard")
    st.button("✦  AI 보고서",use_container_width=True,on_click=navigate,args=("report",),key="side_report")
    # Spacer keeps account controls at the bottom on desktop, independent of main-page scrolling.
    st.markdown('<div class="account-anchor" style="min-height:max(80px,calc(100dvh - 480px))"></div>',unsafe_allow_html=True)
    st.button("⚙  설정",use_container_width=True,on_click=navigate,args=("settings",),key="side_settings")
    st.markdown('<div class="account-name">사용자 프로필</div>',unsafe_allow_html=True)
    st.write("👤",st.session_state.display_name)

{"home":render_home,"dashboard":render_dashboard,"report":render_ai_report,"settings":render_settings}.get(st.session_state.page,render_home)()

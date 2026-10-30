"""
streamlit_app.py — Streamlit Entry Point for INCLUSE · AI Festival Designer.

Architecture:
1. Loads sample or uploaded venue JSON configurations from `data/` (v1.1.0 compatible).
2. Runs Python crowd & contingency simulation + MoIS safety evaluation (`simulation.py`).
3. Embeds the compiled React + Three.js interactive 3D Digital Twin (`dist/`)
   using `streamlit.components.v1.html`, injecting `window.__STREAMLIT_INITIAL_PAYLOAD__`.
4. Provides synchronized Python Plotly KDE heatmaps, Before/After deltas, and JSON export.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd
import plotly.express as px
import streamlit as st
import streamlit.components.v1 as components

from simulation import (
    CONTINGENCY_SCENARIOS,
    PHASE_RANGES,
    evaluate_venue_metrics,
    optimize_layout_python,
    run_crowd_simulation,
)

ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
DIST_DIR = ROOT_DIR / "dist"



def load_sample_files() -> Dict[str, Path]:
    if not DATA_DIR.exists():
        return {}
    return {p.stem.replace("_", " ").title(): p for p in sorted(DATA_DIR.glob("*.json"))}


def build_inlined_3d_component_html(payload: Dict[str, Any]) -> Optional[str]:
    index_file = DIST_DIR / "index.html"
    if not index_file.exists():
        return None

    html = index_file.read_text(encoding="utf-8")

    def replace_css(match: re.Match[str]) -> str:
        href = match.group(1).lstrip("/")
        css_path = DIST_DIR / href
        if css_path.exists():
            return f"<style>{css_path.read_text(encoding='utf-8')}</style>"
        return match.group(0)

    html = re.sub(
        r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*/?>',
        replace_css,
        html,
    )

    def replace_js(match: re.Match[str]) -> str:
        src = match.group(1).lstrip("/")
        js_path = DIST_DIR / src
        if js_path.exists():
            js_code = js_path.read_text(encoding="utf-8")
            return f'<script type="module">{js_code}</script>'
        return match.group(0)

    html = re.sub(
        r'<script[^>]+src="([^"]+)"[^>]*></script>',
        replace_js,
        html,
    )

    bootstrap_script = (
        f"<script>window.__STREAMLIT_INITIAL_PAYLOAD__ = {json.dumps(payload)};</script>"
    )
    html = html.replace("<head>", f"<head>{bootstrap_script}", 1)
    return html


def main() -> None:
    st.title("Event ON · 행사 설계 대시보드")
    st.warning("기획용 계산 모델입니다. 점수와 밀집도 등급은 실측 검증이나 법적 안전 판정이 아닙니다. 원본 3D 화면 파일은 제공되지 않아 표시되지 않습니다.")
    st.caption(
        "첨부된 Python 시뮬레이션 연동 · 가정 기반 전후 비교"
    )

    samples = load_sample_files()

    with st.expander("행사 설정 및 시뮬레이션 조건", expanded=True):
        st.header("1. 행사장 설정 불러오기")
        sample_names = list(samples.keys())
        selected_sample = st.selectbox(
            "샘플 행사 프리셋",
            options=sample_names if sample_names else ["Default Built-in"],
        )

        uploaded_json = st.file_uploader("또는 설계 JSON 업로드", type=["json"])

        if uploaded_json is not None:
            raw_data = json.loads(uploaded_json.read().decode("utf-8"))
        elif selected_sample in samples:
            raw_data = json.loads(samples[selected_sample].read_text(encoding="utf-8"))
        else:
            raw_data = {
                "config": {
                    "eventName": "2026 올림픽공원 봄 뮤직 페스티벌",
                    "eventType": "music_festival",
                    "venueWidth": 200,
                    "venueDepth": 150,
                    "expectedAttendance": 10000,
                    "startTime": "10:00",
                    "endTime": "22:00",
                    "budget": 240000,
                    "objective": "safety_first",
                    "accessibility": {"wideCorridors": False, "stepFreeRoutes": True},
                    "seed": 20260517,
                },
                "facilities": [],
            }

        st.caption("샘플 JSON이 없다면 아래 표에서 시설을 추가하세요. 좌표는 행사장 중심 기준 미터 단위입니다.")
        import pandas as pd
        initial_rows=[dict(name=f.get('name','시설'),type=f.get('type','booth'),x=f.get('position',{}).get('x',0),z=f.get('position',{}).get('z',0),width=f.get('dimensions',{}).get('width',5),depth=f.get('dimensions',{}).get('depth',5),height=f.get('dimensions',{}).get('height',3),capacity=f.get('capacity',20),cost=f.get('cost',0)) for f in raw_data.get('facilities',[])]
        rows=st.data_editor(pd.DataFrame(initial_rows,columns=['name','type','x','z','width','depth','height','capacity','cost']),num_rows='dynamic',key='integrated_facilities',use_container_width=True)
        raw_data['facilities']=[dict(id='custom-'+str(i),name=str(v['name']),type=str(v['type']),position=dict(x=float(v['x']),z=float(v['z'])),dimensions=dict(width=max(.1,float(v['width'])),depth=max(.1,float(v['depth'])),height=max(.1,float(v['height']))),capacity=max(0,int(v['capacity'])),cost=max(0,float(v['cost']))) for i,v in rows.dropna().iterrows()]
        config = dict(raw_data.get("config", {}))
        facilities = list(raw_data.get("facilities", []))

        st.divider()
        st.header("2. 디지털 트윈 & 돌발 시뮬레이션")
        config["eventName"] = st.text_input("행사명", value=config.get("eventName", "Festival"))
        config["expectedAttendance"] = st.slider(
            "예상 방문객 수 (명)",
            min_value=500,
            max_value=30000,
            step=500,
            value=int(config.get("expectedAttendance", 10000)),
        )
        config["budget"] = st.number_input(
            "가용 예산 (USD 환산 · 1$≈1,350원)",
            min_value=20000,
            max_value=1000000,
            step=10000,
            value=int(config.get("budget", 240000)),
        )

        contingency_key = st.selectbox(
            "돌발상황 시나리오",
            options=list(CONTINGENCY_SCENARIOS.keys()),
            format_func=lambda k: CONTINGENCY_SCENARIOS[k],
        )

        phase_options = {label: (lo + hi) / 2.0 for _, label, lo, hi in PHASE_RANGES}
        chosen_phase_label = st.selectbox(
            "시간대 단계",
            options=list(phase_options.keys()),
            index=3,
        )
        progress = st.slider(
            "시간 진행률 (0 = 개장, 1 = 폐장)",
            min_value=0.0,
            max_value=1.0,
            value=float(round(phase_options[chosen_phase_label], 2)),
            step=0.02,
        )

        use_optimized = st.toggle("규칙 기반 공간 조정 적용", value=False)

    opt_facilities, opt_notes = optimize_layout_python(config, facilities)
    active_facilities = opt_facilities if use_optimized else facilities
    if use_optimized:
        config.setdefault("accessibility", {})["wideCorridors"] = True

    sim_orig = run_crowd_simulation(config, facilities, progress, contingency_key)
    metrics_orig = evaluate_venue_metrics(config, facilities, sim_orig)

    sim_opt = run_crowd_simulation(config, opt_facilities, progress, contingency_key)
    metrics_opt = evaluate_venue_metrics(config, opt_facilities, sim_opt)

    active_sim = sim_opt if use_optimized else sim_orig
    active_metrics = metrics_opt if use_optimized else metrics_orig

    k1, k2, k3, k4, k5, k6 = st.columns(6)
    k1.metric("배치 시설 수", f"{active_metrics['totalFacilities']}개")
    k2.metric("총 수용 정원", f"{active_metrics['totalCapacity']:,}명")
    k3.metric("모델 밀집도 분류", active_metrics["moisSafetyLabel"])
    k4.metric("피크 밀집도", f"{active_metrics['peakDensity']:.2f} 명/m²")
    k5.metric("예상 평균 대기시간", f"{active_metrics['avgWaitMinutes']}분")
    k6.metric(
        "종합 적합도 점수",
        f"{active_metrics['scores']['overall']} / 100",
        delta=(
            f"{metrics_opt['scores']['overall'] - metrics_orig['scores']['overall']:+d}점"
            if use_optimized
            else None
        ),
    )

    tab_3d, tab_py, tab_export = st.tabs(
        [
            "3D 디지털 트윈 (React + Three.js)",
            "Python KDE 혼잡도 히트맵 & 전·후 비교",
            "JSON 데이터 내보내기 (v1.1.0)",
        ]
    )

    with tab_3d:
        payload_for_3d = {
            "config": config,
            "facilities": active_facilities,
            "contingency": contingency_key,
        }
        bundled_html = build_inlined_3d_component_html(payload_for_3d)
        if bundled_html:
            components.html(bundled_html, height=840, scrolling=False)
        else:
            st.warning(
                "원본 3D 화면 소스와 dist 폴더가 없어 이 화면은 표시할 수 없습니다. Python 히트맵 탭은 이용할 수 있습니다. 전체 소스 확보 후에만 다음 빌드가 가능합니다:\n\n"
                "```bash\nnpm install\nnpm run build\n```"
            )

    with tab_py:
        col_map, col_scores = st.columns([7, 5])
        with col_map:
            st.subheader(f"공간 군중 밀집도 히트맵 ({active_sim['phaseLabel']})")
            grid_arr = np.array(active_sim["densityGrid"])
            fig = px.imshow(
                grid_arr,
                color_continuous_scale=["#f0fdf4", "#22c55e", "#eab308", "#f97316", "#dc2626"],
                labels={"color": "명/m²"},
                aspect="auto",
            )
            fig.update_layout(margin={"l": 10, "r": 10, "t": 10, "b": 10}, height=380)
            st.plotly_chart(fig, use_container_width=True)

        with col_scores:
            st.subheader("설계 전·후 정량 비교")
            comp_df = pd.DataFrame(
                [
                    {
                        "평가 지표": "종합 적합도 (/100)",
                        "기존 설계": metrics_orig["scores"]["overall"],
                        "AI 최적화": metrics_opt["scores"]["overall"],
                    },
                    {
                        "평가 지표": "피크 밀집도 (명/m²)",
                        "기존 설계": metrics_orig["peakDensity"],
                        "AI 최적화": metrics_opt["peakDensity"],
                    },
                    {
                        "평가 지표": "예상 평균 대기시간 (분)",
                        "기존 설계": metrics_orig["avgWaitMinutes"],
                        "AI 최적화": metrics_opt["avgWaitMinutes"],
                    },
                    {
                        "평가 지표": "포용 접근성 점수 (/100)",
                        "기존 설계": metrics_orig["scores"]["accessibility"],
                        "AI 최적화": metrics_opt["scores"]["accessibility"],
                    },
                    {
                        "평가 지표": "예산 사용률 (%)",
                        "기존 설계": metrics_orig["budgetUsagePct"],
                        "AI 최적화": metrics_opt["budgetUsagePct"],
                    },
                ]
            )
            st.dataframe(comp_df, use_container_width=True, hide_index=True)

            st.markdown("**XAI 최적화 실행 내역:**")
            for note in opt_notes:
                st.write(f"- {note}")

        if active_sim["bottlenecks"]:
            st.subheader("예측 병목 및 대기열 발생 시설")
            st.dataframe(
                pd.DataFrame(active_sim["bottlenecks"]),
                use_container_width=True,
                hide_index=True,
            )

    with tab_export:
        export_payload = {
            "schemaVersion": "1.1.0",
            "config": config,
            "contingency": contingency_key,
            "facilities": active_facilities,
            "metricsSummary": active_metrics,
        }
        export_str = json.dumps(export_payload, ensure_ascii=False, indent=2)
        st.download_button(
            label="현재 디지털 트윈 JSON 다운로드",
            data=export_str,
            file_name="incluse_festival_venue_export.json",
            mime="application/json",
        )
        st.code(export_str, language="json")


if __name__ == "__main__":
    main()
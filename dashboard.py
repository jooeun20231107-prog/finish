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


def python_analysis() -> None:
    st.title("INCLUSE · 생성형 AI 기반 행사 자동 설계 디지털 트윈")
    st.caption(
        "Three.js 3D 디지털 트윈 · 모델 기반 밀집도 분류 · 돌발상황 시뮬레이션 (`simulation.py` 연동)"
    )

    samples = load_sample_files()

    with st.expander("Python 분석 조건 · JSON 불러오기", expanded=False):
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

        use_optimized = st.toggle("INCLUSE AI 공간 최적화 적용", value=False)

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
                "3D 프런트엔드 빌드 산출물(`dist/`)이 아직 생성되지 않았습니다. 프로젝트 루트에서 한 번 빌드해 주세요:\n\n"
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

def main():
    st.title("Event ON · 3D 행사 설계")
    st.caption("가정 기반 기획 시뮬레이터 · 실측 검증이나 안전 인증이 아닙니다.")
    bundled = build_inlined_3d_component_html({})
    if bundled:
        components.html(bundled, height=1000, scrolling=True)
    else:
        st.info("GitHub Actions에서 3D 화면을 만드는 중이거나 빌드가 아직 실행되지 않았습니다. 저장소 Actions의 Build Event ON을 확인하세요. 완료 후 앱을 재시작하면 표시됩니다.")
    with st.expander("별도 Python 분석 · JSON으로 설계 불러오기", expanded=False):
        st.caption("3D 편집 상태는 자동 전달되지 않습니다. 3D에서 JSON을 내보내 아래에 업로드하세요.")
        python_analysis()

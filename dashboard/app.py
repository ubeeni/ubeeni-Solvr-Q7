import pandas as pd
import streamlit as st
import plotly.express as px

# 1. 데이터 불러오기
df = pd.read_csv("../scripts/release_raw.csv")
df["배포일시"] = pd.to_datetime(df["배포일시"])
df["year_month"] = df["배포일시"].dt.to_period("M").astype(str)
df["module"] = df["태그명"].str.extract(r'@(.*?)@')

st.title("📊 GitHub 릴리즈 대시보드")

# 2. 월별 릴리즈 수 차트
st.subheader("1. 월별 릴리즈 추이")
monthly = df.groupby(["레포지토리", "year_month"]).size().reset_index(name="count")
fig1 = px.line(monthly, x="year_month", y="count", color="레포지토리", markers=True)
st.plotly_chart(fig1)

# 3. 릴리즈가 많은 상위 모듈
st.subheader("2. 릴리즈 상위 모듈 (Top 10)")
top_modules = df["module"].value_counts().head(10).reset_index()
top_modules.columns = ["module", "count"]
fig2 = px.bar(top_modules, x="module", y="count", text="count")
st.plotly_chart(fig2)

# 4. 작성자별 릴리즈 비율
st.subheader("3. 작성자별 릴리즈 비율")
authors = df["작성자"].value_counts().reset_index()
authors.columns = ["author", "count"]
fig3 = px.pie(authors, names="author", values="count")
st.plotly_chart(fig3)

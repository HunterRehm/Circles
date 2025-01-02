import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import random

# You are pulling data from https://www.bls.gov/oes/tables.htm

# Set page configuration
st.set_page_config(page_title="Wisconsin Job Market Analysis", layout="wide")

# Load the data
@st.cache_data(show_spinner=False)
def load_data(year):
    try:
        file_path = f"data/state_M{year}_dl.xlsx"
        df = pd.read_excel(file_path)
        df.columns = df.columns.str.upper()
        
        # Handle different column names for state/area
        if 'STATE' in df.columns and year in [2017, 2018]:
            df = df.rename(columns={'STATE': 'AREA_TITLE'})
        
        # Convert numeric columns
        numeric_columns = ["TOT_EMP", "A_MEAN"]
        for col in numeric_columns:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
        
        df['Year'] = year
        return df
    except Exception as e:
        return pd.DataFrame()

try:
    # Load and combine data for all years
    df_2017 = load_data(2017)
    df_2018 = load_data(2018)
    df_2019 = load_data(2019)
    df_2020 = load_data(2020)
    df_2021 = load_data(2021)
    df_2022 = load_data(2022)
    df_2023 = load_data(2023)
    
    if not any(df.empty for df in [df_2017, df_2018, df_2019, df_2020, df_2021, df_2022, df_2023]):
        df = pd.concat([df_2017, df_2018, df_2019, df_2020, df_2021, df_2022, df_2023])
        wi_data = df[df['AREA_TITLE'].str.contains('Wisconsin', case=False, na=False)]
        
        if not wi_data.empty:
            # Header
            st.markdown("""
                <h1 style='text-align: center; color: #1f77b4; margin-bottom: 30px;'>
                    Wisconsin Wage Trends (2017-2023)
                </h1>
            """, unsafe_allow_html=True)

            # Function to create tiny trend plot
            def create_tiny_plot(occupation):
                occupation_data = wi_data[wi_data['OCC_TITLE'] == occupation]
                wage_trends = occupation_data.groupby('Year')['A_MEAN'].mean().reset_index()
                wage_trends = wage_trends.dropna(subset=['A_MEAN']).sort_values('Year')
                
                earliest_wage = wage_trends['A_MEAN'].iloc[0]
                latest_wage = wage_trends['A_MEAN'].iloc[-1]
                earliest_year = wage_trends['Year'].iloc[0]
                latest_year = wage_trends['Year'].iloc[-1]
                
                is_trending_up = latest_wage > earliest_wage
                color = 'green' if is_trending_up else 'red'
                
                fig = go.Figure()
                fig.add_trace(go.Scatter(
                    x=wage_trends['Year'],
                    y=wage_trends['A_MEAN'],
                    mode='lines+markers',
                    line=dict(color=color, width=2),
                    marker=dict(size=4)
                ))
                
                fig.update_layout(
                    height=120,
                    width=240,
                    margin=dict(l=30, r=10, t=20, b=20),
                    paper_bgcolor='rgba(0,0,0,0)',
                    plot_bgcolor='rgba(0,0,0,0)',
                    showlegend=False,
                    xaxis=dict(
                        showgrid=True,
                        showticklabels=True,
                        showline=True,
                        range=[2017, 2023],
                        gridcolor='rgba(128,128,128,0.1)',
                        linecolor='rgba(128,128,128,0.3)'
                    ),
                    yaxis=dict(
                        showgrid=True,
                        showticklabels=True,
                        showline=True,
                        tickformat='$,.0f',
                        gridcolor='rgba(128,128,128,0.1)',
                        linecolor='rgba(128,128,128,0.3)',
                        title=dict(
                            text='Annual Wage',
                            standoff=5
                        )
                    ),
                    font=dict(size=8)
                )
                
                percent_change = ((latest_wage - earliest_wage) / earliest_wage * 100)
                return fig, is_trending_up, percent_change, earliest_year, latest_year

            # Process occupations
            all_occupations = sorted(wi_data['OCC_TITLE'].unique())
            occupation_trends = []
            for occupation in all_occupations:
                occupation_data = wi_data[wi_data['OCC_TITLE'] == occupation]
                wage_trends = occupation_data.groupby('Year')['A_MEAN'].mean().reset_index()
                wage_trends = wage_trends.dropna(subset=['A_MEAN']).sort_values('Year')
                
                if len(wage_trends) >= 3:
                    earliest_wage = wage_trends['A_MEAN'].iloc[0]
                    latest_wage = wage_trends['A_MEAN'].iloc[-1]
                    earliest_year = wage_trends['Year'].iloc[0]
                    latest_year = wage_trends['Year'].iloc[-1]
                    
                    percent_change = ((latest_wage - earliest_wage) / earliest_wage * 100)
                    is_trending_up = percent_change > 0
                    
                    occupation_trends.append({
                        'occupation': occupation,
                        'is_trending_up': is_trending_up,
                        'percent_change': percent_change
                    })

            # Select and sort trends
            increasing = [ot for ot in occupation_trends if ot['is_trending_up']]
            decreasing = [ot for ot in occupation_trends if not ot['is_trending_up']]
            increasing.sort(key=lambda x: abs(x['percent_change']), reverse=True)
            decreasing.sort(key=lambda x: abs(x['percent_change']), reverse=True)
            selected_trends = increasing[:15] + decreasing[:5]
            random.shuffle(selected_trends)
            selected_occupations = [trend['occupation'] for trend in selected_trends]

            # Create grid of plots
            for i in range(0, 20, 5):
                cols = st.columns(5)
                for j, col in enumerate(cols):
                    current_position = i + j
                    if current_position < len(selected_occupations):
                        occupation = selected_occupations[current_position]
                        fig, is_trending_up, percent_change, earliest_year, latest_year = create_tiny_plot(occupation)
                        with col:
                            st.plotly_chart(fig, use_container_width=True)
                            trend_color = "green" if is_trending_up else "red"
                            st.markdown(
                                f"""<div style='text-align: center; color: {trend_color}; 
                                font-size: 12px; margin-top: -15px; padding: 0 5px;'>
                                {occupation}<br>
                                <span style='font-size: 10px;'>
                                ({percent_change:+.1f}% from {earliest_year} to {latest_year})</span>
                                </div>""", 
                                unsafe_allow_html=True
                            )
except Exception as e:
    pass  # Silently handle any errors to keep the interface clean

# Hide Streamlit Style
hide_st_style = """
    <style>
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
    .block-container {
        padding-top: 1rem;
        padding-bottom: 0rem;
        padding-left: 1rem;
        padding-right: 1rem;
    }
    </style>
"""
st.markdown(hide_st_style, unsafe_allow_html=True)
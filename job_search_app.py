import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import random

# Set page configuration
st.set_page_config(page_title="Wisconsin Job Market Analysis", layout="wide")

# At the start of your script, add this debug section:
def print_file_headers():
    years = [2019, 2020, 2021, 2022, 2023]
    for year in years:
        try:
            df = pd.read_excel(f"state_M{year}_dl.xlsx")
            print(f"\nColumns in {year} data:")
            print(df.columns.tolist())
            print("\nFirst few rows:")
            print(df.head(2))
        except Exception as e:
            print(f"Could not read {year} file: {e}")

# Call this before your main code
print_file_headers()

# Load the data
@st.cache_data(show_spinner=False)
def load_data(year):
    try:
        # Updated path to read from data folder
        df = pd.read_excel(f"data/state_M{year}_dl.xlsx")
        
        # Convert all column names to uppercase for consistency
        df.columns = df.columns.str.upper()
        
        # Convert numeric columns (now using uppercase names)
        numeric_columns = ["TOT_EMP", "A_MEAN"]
        for col in numeric_columns:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
        
        df['Year'] = year
        return df
    except Exception as e:
        st.error(f"Error loading data for year {year}: {str(e)}")
        print(f"Detailed error for {year}:", e)
        return pd.DataFrame()

try:
    # Load and combine data for all years
    df_2019 = load_data(2019)
    df_2020 = load_data(2020)
    df_2021 = load_data(2021)
    df_2022 = load_data(2022)
    df_2023 = load_data(2023)
    
    if not any(df.empty for df in [df_2019, df_2020, df_2021, df_2022, df_2023]):
        df = pd.concat([df_2019, df_2020, df_2021, df_2022, df_2023])
        wi_data = df[df['AREA_TITLE'] == 'Wisconsin']
        
        if wi_data.empty:
            st.error("No data found for Wisconsin")
        else:
            # Header
            st.markdown("""
                <h1 style='text-align: center; color: #1f77b4; margin-bottom: 30px;'>
                    Wisconsin Wage Trends (2019-2023)
                </h1>
            """, unsafe_allow_html=True)

            # Function to create tiny trend plot
            def create_tiny_plot(occupation):
                occupation_data = wi_data[wi_data['OCC_TITLE'] == occupation]
                wage_trends = occupation_data.groupby('Year')['A_MEAN'].mean().reset_index()
                wage_trends = wage_trends.dropna(subset=['A_MEAN']).sort_values('Year')
                
                # Get earliest and latest valid data points
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
                    margin=dict(l=0, r=0, t=0, b=0),
                    paper_bgcolor='rgba(0,0,0,0)',
                    plot_bgcolor='rgba(0,0,0,0)',
                    showlegend=False,
                    xaxis=dict(
                        showgrid=False, 
                        showticklabels=False, 
                        showline=False,
                        range=[2018, 2023]  # Fixed x-axis range
                    ),
                    yaxis=dict(
                        showgrid=False, 
                        showticklabels=False, 
                        showline=False
                    )
                )
                
                # Calculate percent change using earliest and latest valid points
                percent_change = ((latest_wage - earliest_wage) / earliest_wage * 100)
                
                return fig, is_trending_up, percent_change, earliest_year, latest_year

            # Analyze all occupations first
            all_occupations = sorted(wi_data['OCC_TITLE'].unique())
            occupation_trends = []
            for occupation in all_occupations:
                occupation_data = wi_data[wi_data['OCC_TITLE'] == occupation]
                wage_trends = occupation_data.groupby('Year')['A_MEAN'].mean().reset_index()
                # Remove NaN values and sort by year
                wage_trends = wage_trends.dropna(subset=['A_MEAN']).sort_values('Year')
                
                # Only include occupations with at least 3 valid data points
                if len(wage_trends) >= 3:
                    earliest_wage = wage_trends['A_MEAN'].iloc[0]
                    latest_wage = wage_trends['A_MEAN'].iloc[-1]
                    earliest_year = wage_trends['Year'].iloc[0]
                    latest_year = wage_trends['Year'].iloc[-1]
                    
                    # Calculate percent change from earliest to latest valid point
                    percent_change = ((latest_wage - earliest_wage) / earliest_wage * 100)
                    is_trending_up = percent_change > 0
                    
                    occupation_trends.append({
                        'occupation': occupation,
                        'is_trending_up': is_trending_up,
                        'percent_change': percent_change,
                        'num_points': len(wage_trends),
                        'year_range': f"{earliest_year}-{latest_year}",
                        'earliest_year': earliest_year,
                        'latest_year': latest_year
                    })

            # Separate into increasing and decreasing trends
            increasing = [ot for ot in occupation_trends if ot['is_trending_up']]
            decreasing = [ot for ot in occupation_trends if not ot['is_trending_up']]

            # Sort both lists by absolute percent change to get most significant changes
            increasing.sort(key=lambda x: abs(x['percent_change']), reverse=True)
            decreasing.sort(key=lambda x: abs(x['percent_change']), reverse=True)

            # Select 15 increasing and 5 decreasing trends
            selected_increasing = increasing[:15]
            selected_decreasing = decreasing[:5]

            # Combine and shuffle
            selected_trends = selected_increasing + selected_decreasing
            random.shuffle(selected_trends)

            # Get final list of selected occupations
            selected_occupations = [trend['occupation'] for trend in selected_trends]

            # Create 4x5 grid
            rows = 4
            cols_per_row = 5

            # Create grid of plots
            for i in range(0, 20, cols_per_row):
                cols = st.columns(cols_per_row)
                for j, col in enumerate(cols):
                    if i + j < len(selected_occupations):
                        occupation = selected_occupations[i + j]
                        fig, is_trending_up, percent_change, earliest_year, latest_year = create_tiny_plot(occupation)
                        with col:
                            st.plotly_chart(fig, use_container_width=True)
                            trend_color = "green" if is_trending_up else "red"
                            st.markdown(
                                f"""<div style='text-align: center; color: {trend_color}; 
                                font-size: 12px; margin-top: -15px; padding: 0 5px;'>
                                {occupation}<br>
                                <span style='font-size: 10px;'>({percent_change:+.1f}% from {earliest_year} to {latest_year})</span>
                                </div>""", 
                                unsafe_allow_html=True
                            )

    else:
        st.error("Failed to load data for one or more years")
except Exception as e:
    st.error(f"An error occurred: {str(e)}")

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
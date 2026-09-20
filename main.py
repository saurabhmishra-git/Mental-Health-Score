import warnings
from pathlib import Path
import joblib
from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Literal
import pandas as pd
from fastapi.middleware.cors import CORSMiddleware

# Ignore version mismatch / benign sklearn warnings
warnings.filterwarnings("ignore")

BASE_DIR = Path(__file__).resolve().parent
model = joblib.load(BASE_DIR / "New_Mental_Health_Model.pkl")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=['*'],
    allow_headers=['*']
)

top_countries=['Other','India','USA','Canada','Australia', 'UK','Germany','Mexico','Turkey', 'France']

class StudentData(BaseModel):
    gender                  :Literal['Male','Female']
    age                     :int =Field(...,ge=10, le=100)
    country                 :str
    academic_level          :Literal['Undergraduate','Graduate','High School']
    most_used_platform      :Literal['Facebook','LinkedIn','Instagram', 'Snapchat','Twitter', 'YouTube','TikTok','LINE','KakaoTalk','VKontakte','WhatsApp','WeChat']
    purpose_of_use          :Literal['Networking', 'Education', 'Entertainment', 'News']
    avg_daily_usage_hours   :float=Field(...,ge=0  , le=24)
    daily_unlocks           :int =Field(...,ge=0)
    study_hours             :float =Field(...,ge=0,le=24)
    physical_activity_hours :float =Field(...,ge=0,le=24)
    sleep_hours_per_night   :float  =Field(..., ge=0 ,  le=24)
    stress_level            :Literal['Medium', 'Low', 'Very High', 'High']



def get_health_signal(score: float) -> str:
    if score > 7.5:
        return "Excellent"
    elif score >= 5.5:
        return "Moderate"
    else:
        return "At Risk"

# describe what we send back 
class PredictionResponse(BaseModel):
    predicted_mental_health_score: float
    health_status: str = Field(..., description="Mental health status: 'Excellent', 'Moderate', or 'At Risk'")













@app.get('/')
def greet():
    return {"message": "welcome to my blog"}


@app.post('/predict',response_model=PredictionResponse)
def predict(data:StudentData):
    country_grp=data.country if data.country in top_countries else 'Other'
    input_row=pd.DataFrame([{
 'Age'                       :data.age,
 'Gender'                    :data.gender,
 'Country'                   :data.country,
 'Academic_Level'            :data.academic_level,
 'Most_Used_Platform'        :data.most_used_platform,
 'Purpose_Of_Use'            :data.purpose_of_use,
 'Avg_Daily_Usage_Hours'     :data.avg_daily_usage_hours,
 'Daily_Unlocks'             :data.daily_unlocks,
 'Study_Hours'               :data.study_hours,
 'Physical_Activity_Hours'   :data.physical_activity_hours,
 'Sleep_Hours_Per_Night'     :data.sleep_hours_per_night,
 'Stress_Level'              :data.stress_level,
 'grouped_country'           :country_grp
    }
    ])

    prediction=model.predict(input_row)[0]
    score = round(float(prediction), 2)
    status = get_health_signal(score)
    return PredictionResponse(
        predicted_mental_health_score=score,
        health_status=status
    )

# Student Mental Health Score Predictor

An end-to-end Machine Learning pipeline and FastAPI web application that predicts a student's mental health score based on their daily habits, social media usage, physical activity, study routines, and stress levels.

---

## 🚀 Features

- **Machine Learning Pipeline**: Trained `RandomForestRegressor` with scikit-learn preprocessing (`ColumnTransformer`, `StandardScaler`, `OneHotEncoder`, `OrdinalEncoder`).
- **RESTful API**: Built with **FastAPI** and **Pydantic** for input validation and real-time inference.
- **Interactive UI**: Clean responsive web dashboard with an interactive speedometer gauge and categorized signals:
  - **`> 7.5`**: Excellent
  - **`5.5 – 7.5`**: Moderate
  - **`< 5.5`**: At Risk
- **CORS Enabled**: Ready for frontend-backend integration.

---

## 📁 Project Structure

```text
├── main.py                                      # FastAPI backend & prediction endpoint
├── New_Mental_Health_Model.pkl                  # Trained Scikit-Learn pipeline
├── Student Social Media And Mental Health Impact.csv # Dataset
├── mental (1).ipynb                             # Jupyter notebook for EDA & training
├── index.html                                   # Web dashboard frontend
├── script.js                                    # Frontend logic & API caller
├── style.css                                    # Dashboard styling
├── requirements.txt                             # Python dependencies
└── .gitignore                                   # Ignored files (virtual environment, caches)
```

---

## ⚙️ Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone <YOUR_REPOSITORY_URL>
   cd "Machine learning"
   ```

2. **Create and activate a virtual environment**:
   ```powershell
   python -m venv myenv
   .\myenv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

---

## ▶️ Running the Application

1. **Start the FastAPI backend**:
   ```powershell
   uvicorn main:app --reload
   ```
   - API will be live at: `http://127.0.0.1:8000`
   - Interactive Swagger Docs: `http://127.0.0.1:8000/docs`

2. **Launch the Frontend**:
   - Double-click or open `index.html` in any web browser.
   - Enter student details and click **Predict Score**.

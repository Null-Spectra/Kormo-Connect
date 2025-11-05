# Kormo Connect

<div align="center">
  
<!-- ![Kormo Connect Logo](https://via.placeholder.com/200x80/4F46E5/FFFFFF?text=Kormo+Connect) -->

**An AI-powered platform that intelligently connects Professionals to Employers using deep suitability analysis.**

<!-- [🚀 Live Demo](#) • [📹 Watch Demo](#) • [📊 View Stats](#) -->

</div>

---

## 🎯 Live Demo & Screencast

<div align="center">

[![Live Demo](https://img.shields.io/badge/Live_Demo-Visit_Now-4F46E5?style=for-the-badge&logo=rocket&logoColor=white)](https://kormoconnect.netlify.app/)
<!-- [![View Screencast](https://img.shields.io/badge/Screencast-Watch_Preview-EF4444?style=for-the-badge&logo=youtube&logoColor=white)](#) -->

<!-- Demo GIF placeholder - replace with actual demo
![Demo GIF](https://via.placeholder.com/800x400/1F2937/FFFFFF?text=Demo+Coming+Soon) -->

*Click the buttons above to see the live application in action*

</div>

---

## 🚀 The Problem

Finding the right talent is hard, and applying to jobs feels like a guessing game. Employers spend countless hours reviewing resumes that don't match their needs, while talented professionals get lost in the noise of job applications. Traditional job platforms are essentially digital bulletin boards - they show you the jobs, but give you no insight into whether you're actually a good fit, or help you find the opportunities where you would truly excel.

The current system treats job hunting as a numbers game rather than a strategic matching process, leading to frustration, missed opportunities, and hiring inefficiencies that cost everyone time and money.

## ✨ Our Solution

**Kormo Connect** - suitability Platform, revolutionizes the job market by using **Google Gemini AI** to create intelligent, two-way matching between professionals and employers. Our platform doesn't just list jobs - it analyzes, scores, and provides actionable insights that make every connection meaningful.

**What makes us different:**
- **AI-Powered Suitability Analysis**: Every professional gets instant AI-generated compatibility scores, strengths, and improvement areas for any job
- **Intelligent Job Discovery**: Our "Find Best Matches" feature uses AI to analyze your profile and automatically surface the perfect opportunities
- **Smart Profile Building**: Upload your CV once, and our AI fills out your entire profile automatically
- **Real-Time Feedback**: Employers can rate professionals, creating a transparent quality system that benefits everyone

---

## 🤖 AI-Powered Features

### 🎯 AI Job Suitability Analysis
Professionals receive an **instant AI-generated compatibility score** (0-100%) for any job, complete with detailed breakdowns of their strengths, weaknesses, and specific skill gaps. This takes the guesswork out of job applications.

### 🔍 AI Smart Search
The "**Find Best Matches**" button uses advanced AI to analyze a professional's complete profile (skills, experience, preferences) and automatically finds the most suitable job opportunities, presenting them ranked by compatibility.

### 📄 AI Profile Auto-Fill
Upload your CV once, and our **AI parses and automatically fills** your entire profile. The system extracts skills, experience, education, and preferences with high accuracy, saving hours of manual data entry.

### 💡 Intelligent Recommendations
Continuous AI analysis provides personalized suggestions for skill development, career path optimization, and profile improvements to increase match success rates.

## ⚙️ Other Core Features

- **🔐 Dual Dashboard System**: Separate, secure interfaces for Employers and Professionals
- **💳 Premium Subscription Model**: Mock payment flows for premium features (AI suggestions, boosted listings, enhanced visibility)
- **⭐ Professional Rating System**: Employers can score professionals, with averages displayed on profiles
- **🔒 Secure Authentication**: Role-based access with Supabase Auth
- **📊 Real-time Analytics**: Track match rates, user engagement, and platform performance
- **📱 Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **⚡ Rate Limiting**: Intelligent throttling to prevent abuse (3 requests/minute for free users, 10 for premium)
- **🛡️ Error Handling**: Comprehensive error management and user feedback systems

---

## 🛠️ Tech Stack

<div align="center">

| **Frontend** | **Backend** | **AI & APIs** | **Deployment** |
|-------------|-------------|---------------|----------------|
| ![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black) | ![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=black) | ![Gemini AI](https://img.shields.io/badge/Google%20Gemini-4285F4?style=flat-square&logo=google&logoColor=white) | ![Netlify](https://img.shields.io/badge/Netlify-00C7B7?style=flat-square&logo=netlify&logoColor=black) |
| ![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white) | ![Edge Functions](https://img.shields.io/badge/Edge%20Functions-FF6B35?style=flat-square&logo=cloudflare&logoColor=white) | ![REST API](https://img.shields.io/badge/REST%20API-FF6B35?style=flat-square&logo=api&logoColor=white) | ![Supabase Deploy](https://img.shields.io/badge/Backend%20Deploy-3ECF8E?style=flat-square&logo=supabase&logoColor=black) |
| ![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white) | ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=flat-square&logo=postgresql&logoColor=white) | ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) | ![SSL Security](https://img.shields.io/badge/SSL-Security-green?style=flat-square&logo=security&logoColor=white) |

**Core Technologies**: React 18 + Vite + TypeScript + Tailwind CSS + Supabase + Google Gemini AI

</div>

---

## ⚡ How to Run This Locally

### Prerequisites
- Node.js 18+ and npm
- Supabase account and project
- Google Gemini AI API key

### Quick Setup

```bash
# Clone the repository
git clone <your-repository-url>
cd kormo-connect

# Install dependencies
npm install
pnpm install

# Environment setup
cp .env.example .env.local

# Configure your .env.local with:
# VITE_SUPABASE_URL=your_supabase_project_url
# VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
# VITE_GEMINI_API_KEY=your_gemini_api_key

# Configure your supabase.js

# Deploy Supabase backend
cd supabase
supabase db push
supabase functions deploy

# Start the development server
cd ..
pnpm run dev
```

### Full Setup Guide

For detailed setup instructions including database schema, environment configuration, and deployment options, see our comprehensive guide:

**[📖 Complete Setup Guide](Coming Soon...)**

---

## 🏆 Hackathon Submission

**This project was built for the Solveo Hackathon 2025**

A revolutionary job matching platform that uses AI to create meaningful connections between professionals and employers. By focusing on intelligent analysis rather than keyword matching, Kormo Connect transforms job searching from a numbers game into a strategic, data-driven experience.

### 🎯 Key Achievements
- ✅ **AI-Powered Matching**: Real-time compatibility analysis using Google Gemini AI
- ✅ **User Experience**: Intuitive dual-dashboard design for both professionals and employers
- ✅ **Technical Excellence**: Scalable architecture with Supabase and modern React
- ✅ **Innovation**: First job platform to provide real-time suitability scoring
- ✅ **Deployment Ready**: Fully functional live demo with proper error handling

### 👥 Team
- **Project Lead, Prompt Engineer, AI Developer & Full-Stack Developer**: [Shaik Rezwan Ahmmed Rafi](https://github.com/Null-Spectra/)
- **Project Manager & Business Strategist**: [Labib Ul Hasan](https://github.com/labib-0)
- **Presentation Designer**: [Masuk Al Aff](https://github.com/masuk1-glitch)
- **Market Research & Outreach**: [Rim Akter](#)

---

<div align="center">

**[🚀 Try the Live Demo](https://kormoconnect.netlify.app/)** • **[📧 Contact Us](#)** • **[⭐ Star this Repository](#)**

*Built with ❤️ using React, Supabase, Google Gemini AI, Minimax & Dyad*

</div>
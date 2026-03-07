# EV Mobile Charging Platform (V1 Demo)

This repository contains the **V1 demo platform** for an on-demand **mobile EV charging service**.

The platform enables stranded EV drivers to request a mobile charger through an app. Dispatch logic assigns the nearest available charging vehicle and provides ETA updates to the customer.

This version demonstrates the **core end-to-end request flow** including:

* Customer request creation
* Dispatch job creation
* Fleet operator acceptance
* Service completion workflow
* Backend API for platform operations

The goal of this version is to validate the **core service model and platform architecture** for a pilot fleet operating in the **DMV region (Washington DC / Maryland / Virginia).**

---

# Tech Stack

Backend

* Python
* Django
* Django REST Framework

Architecture

* Modular Django apps
* API-driven backend
* Dispatch workflow engine

Planned future components

* Native mobile apps (driver + customer)
* Live vehicle tracking
* Automated dispatch optimization
* Payment integration
* Subscription management

---

# Project Setup

Clone the repository:

```
git clone https://github.com/YOUR_USERNAME/EV_App.git
cd EV_App
```

Create a virtual environment:

```
python -m venv .venv
source .venv/bin/activate
```

Install dependencies:

```
pip install -r requirements.txt
```

---

# Environment Variables

Copy the example environment file:

```
cp .env.example .env
```

Fill in the required values.

---

# Run Migrations

```
python manage.py migrate
```

---

# Start Development Server

```
python manage.py runserver
```

Server will run at:

```
http://127.0.0.1:8000
```

---

# Core Django Apps

| App      | Purpose                          |
| -------- | -------------------------------- |
| accounts | User authentication and profiles |
| api      | Public API endpoints             |
| dispatch | Job creation and dispatch logic  |
| fleet    | Vehicle and driver management    |
| frontend | UI layer for demo interface      |

---

# Current Status

This repository represents a **functional V1 prototype** designed to demonstrate the operational model for:

* On-demand EV mobile charging
* Dispatch-based service logistics
* Fleet coordination

Future development will expand this into a **production-grade platform with mobile apps and real-time dispatch intelligence.**

---

# License

Private internal project – prototype stage.

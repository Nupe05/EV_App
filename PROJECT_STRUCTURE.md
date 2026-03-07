# Project Structure

This document explains the architecture of the EV Mobile Charging Platform backend.

---

# Root Directory

```
EV_App/
│
├── accounts/        User authentication and profile management
├── api/             REST API endpoints
├── config/          Django project configuration
├── dispatch/        Service request and dispatch workflow
├── fleet/           Vehicle and driver management
├── frontend/        Web interface for demo interaction
│
├── manage.py
├── requirements.txt
├── README.md
└── PROJECT_STRUCTURE.md
```

---

# App Responsibilities

## accounts

Handles:

* User accounts
* Authentication
* Roles (customer, driver, admin)

Future additions:

* subscription management
* payment accounts

---

## api

Provides API endpoints used by:

* mobile apps
* web frontend
* external integrations

Examples:

```
/api/request-charge
/api/driver/accept-job
/api/dispatch/status
```

---

## dispatch

Core logistics engine responsible for:

* creating service requests
* assigning jobs
* managing service lifecycle

Example lifecycle:

```
REQUESTED → ASSIGNED → EN_ROUTE → CHARGING → COMPLETE
```

---

## fleet

Tracks operational resources:

* charging vehicles
* drivers/operators
* availability status

Future capabilities:

* vehicle telemetry
* battery capacity tracking
* route optimization

---

## frontend

Provides the UI layer used for demo interaction.

This will eventually be replaced by:

* iOS customer app
* Android customer app
* Driver operator app

---

# Configuration

```
config/
```

Contains Django project configuration:

* settings.py
* urls.py
* wsgi.py
* asgi.py

---

# Long Term Architecture

The platform will evolve toward:

```
Mobile Apps
     ↓
API Gateway
     ↓
Dispatch Engine
     ↓
Fleet Operations
     ↓
Charging Hardware
```

The current system focuses on validating the **dispatch and service workflow** before scaling into a full mobile platform.

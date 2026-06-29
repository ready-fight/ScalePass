# Product Definition

## Product

ScalePass AWS is a high-scale event reservation platform for limited-capacity events.

## User Features

- Register and login
- Browse available events
- Join reservation flow
- Reserve a seat/ticket
- View reservation status
- Cancel reservation

## Admin Features

- Create events
- Set event capacity
- Open or close reservations
- View reservation statistics

## Main Engineering Requirement

The system must prevent overselling when many users attempt to reserve the same event at the same time.

## Scale Scenario

An event opens for reservations and 10,000 users arrive within 5 minutes.

The backend must handle the spike while keeping reservation data correct.
# gcloud Cheat Sheet

The `gcloud` command-line interface (CLI) is the primary tool for managing your Google Cloud resources. Here's a cheat sheet of common `gcloud` commands to help you get started and manage your projects efficiently:

### Getting Started

*   **Initialize, authorize, and configure the `gcloud` CLI:** `gcloud init`
*   **Display `gcloud` CLI version and installed components:** `gcloud version`
*   **Install specific components:** `gcloud components install [COMPONENT_NAME]`
*   **Update your `gcloud` CLI to the latest version:** `gcloud components update`
*   **Display current `gcloud` CLI environment details:** `gcloud info`

### Configuration & Personalization

*   **Set a default Google Cloud project:** `gcloud config set project [PROJECT_ID]`
*   **Fetch the value of a `gcloud` CLI property:** `gcloud config get-value [PROPERTY_NAME]`
*   **Display all properties for the current configuration:** `gcloud config list`
*   **Create a new named configuration:** `gcloud config configurations create [CONFIGURATION_NAME]`
*   **List all available configurations:** `gcloud config configurations list`
*   **Switch to an existing named configuration:** `gcloud config configurations activate [CONFIGURATION_NAME]`
*   **List all projects associated with your account:** `gcloud projects list`

### Authentication & Credentials

*   **Authorize Google Cloud access with user credentials:** `gcloud auth login`
*   **Authorize Google Cloud access with service account credentials:** `gcloud auth activate-service-account`
*   **Manage Application Default Credentials (ADC):** `gcloud auth application-default`
*   **List all credentialed accounts:** `gcloud auth list`
*   **Display the current account's access token:** `gcloud auth print-access-token`
*   **Remove access credentials for an account:** `gcloud auth revoke [ACCOUNT]`

### Virtual Machines & Compute Engine

*   **List Compute Engine zones:** `gcloud compute zones list`
*   **Create a VM instance:** `gcloud compute instances create [INSTANCE_NAME]`
*   **Display a VM instance's details:** `gcloud compute instances describe [INSTANCE_NAME]`
*   **List all VM instances in a project:** `gcloud compute instances list`
*   **Connect to a VM instance by using SSH:** `gcloud compute ssh [INSTANCE_NAME]`
*   **Stop a VM instance:** `gcloud compute instances stop [INSTANCE_NAME]`
*   **Start a VM instance:** `gcloud compute instances start [INSTANCE_NAME]`
*   **Delete a VM instance:** `gcloud compute instances delete [INSTANCE_NAME]`
*   **Create snapshot of persistent disks:** `gcloud compute disks snapshot`

### Identity and Access Management (IAM)

*   **List IAM grantable roles for a resource:** `gcloud iam list-grantable-roles`
*   **Create a custom role for a project or organization:** `gcloud iam roles create`
*   **Create a service account for a project:** `gcloud iam service-accounts create`
*   **Add an IAM policy binding to a service account:** `gcloud iam service-accounts add-iam-policy-binding`
*   **List a service account's keys:** `gcloud iam service-accounts keys list`

### Global Flags

These flags are available across most `gcloud` commands:

*   `--help`: Display detailed help for a command.
*   `--project [PROJECT_ID]`: Specify the project for the command.
*   `--quiet` or `-q`: Disable interactive prompting.
*   `--verbosity [LEVEL]`: Set verbosity level (debug, info, warning, error, critical, none).
*   `--format [FORMAT]`: Set output format (e.g., `json`, `yaml`, `text`, `table`, `csv`).
*   `--filter [EXPRESSION]`: Filter results based on resource attributes.
*   `--sort-by [FIELD]`: Sort results.
*   `--limit [NUMBER]`: Limit the number of results.

### Other Useful Commands

*   **App Engine:** `gcloud app browse` (open app in browser), `gcloud app deploy` (deploy app).
*   **Cloud Storage:** `gsutil mb` (make bucket), `gsutil ls` (list items in bucket).
*   **Pub/Sub:** `gcloud pubsub topics create`, `gcloud pubsub subscriptions create`, `gcloud pubsub topics publish`.
*   **Logging:** `gcloud logging logs list` (list project's logs), `gcloud logging read` (read logs).
*   **Kubernetes Engine (GKE):** `gcloud container clusters list` (list clusters), `gcloud container clusters get-credentials` (update kubeconfig).

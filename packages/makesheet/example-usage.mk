# Example usage of makesheet package in Makefile workflows
# 
# Set these environment variables:
# DEPLOYMENT_ID = your Google Apps Script deployment ID
# SHEET_ID = the Google Sheet ID you want to track

# Target file to store the sheet's timestamp
SHEET_TIMESTAMP_FILE = sheet.timestamp

# URL for the deployed makesheet web app
SHEET_INFO_URL = https://script.google.com/macros/s/$(DEPLOYMENT_ID)/exec

# Create a timestamp file based on the sheet's last modification time
$(SHEET_TIMESTAMP_FILE):
	curl -s "$(SHEET_INFO_URL)?sheetId=$(SHEET_ID)" | \
	jq -r '.modifiedTime' | \
	xargs -I {} touch -d {} $@

# Example target that depends on the sheet timestamp
data-processing: $(SHEET_TIMESTAMP_FILE)
	@echo "Processing data from sheet (last modified: $$(cat $(SHEET_TIMESTAMP_FILE)))"
	# Your data processing commands here

# Clean up timestamp file
clean:
	rm -f $(SHEET_TIMESTAMP_FILE)

# Check if sheet has been modified since last processing
check-sheet-status: $(SHEET_TIMESTAMP_FILE)
	@if [ -f $(SHEET_TIMESTAMP_FILE) ]; then \
		echo "Sheet timestamp file exists: $$(ls -la $(SHEET_TIMESTAMP_FILE))"; \
	else \
		echo "Sheet timestamp file does not exist, will be created"; \
	fi

# Alternative approach: always check and update if sheet is newer
update-if-newer:
	@CURRENT_TIME=$$(curl -s "$(SHEET_INFO_URL)?sheetId=$(SHEET_ID)" | jq -r '.modifiedTime'); \
	if [ ! -f $(SHEET_TIMESTAMP_FILE) ] || [ "$$(date -r $(SHEET_TIMESTAMP_FILE) -u +%Y-%m-%dT%H:%M:%S.%3NZ)" != "$$CURRENT_TIME" ]; then \
		echo "Sheet has been modified, updating timestamp"; \
		echo "$$CURRENT_TIME" | xargs -I {} touch -d {} $(SHEET_TIMESTAMP_FILE); \
	else \
		echo "Sheet has not been modified since last check"; \
	fi

.PHONY: data-processing clean check-sheet-status update-if-newer
//go:build e2e

// Package e2e contains end-to-end API tests.
package e2e

import (
	"bytes"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"immortal-architecture-clean/backend/tests/e2e/testutil"
	basetestutil "immortal-architecture-clean/backend/tests/testutil"
)

func TestTemplateAPI_CRUD(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping e2e test")
	}

	pg := basetestutil.SetupPostgres(t)
	server := testutil.StartTestServer(t, pg.ConnectionString)

	// Create test account
	account := basetestutil.CreateTestAccount(t, server.Pool(), basetestutil.TestAccount{
		FirstName: "Template",
		LastName:  "Owner",
	})

	var createdTemplateID string

	t.Run("POST /api/templates - Create template", func(t *testing.T) {
		reqBody := map[string]interface{}{
			"name":    "E2E Test Template",
			"ownerId": account.ID,
			"fields": []map[string]interface{}{
				{"label": "Background", "order": 1, "isRequired": true},
				{"label": "Solution", "order": 2, "isRequired": true},
				{"label": "Notes", "order": 3, "isRequired": false},
			},
		}
		body, _ := json.Marshal(reqBody)

		resp, err := http.Post(
			server.URL+"/api/templates",
			"application/json",
			bytes.NewReader(body),
		)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var result map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)

		createdTemplateID = result["id"].(string)
		assert.NotEmpty(t, createdTemplateID)
		assert.Equal(t, "E2E Test Template", result["name"])

		fields := result["fields"].([]interface{})
		assert.Len(t, fields, 3)
	})

	t.Run("GET /api/templates/:id - Get template", func(t *testing.T) {
		resp, err := http.Get(server.URL + "/api/templates/" + createdTemplateID)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var result map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)

		assert.Equal(t, createdTemplateID, result["id"])
		assert.Equal(t, "E2E Test Template", result["name"])
		assert.Equal(t, false, result["isUsed"]) // No notes yet

		// Verify owner info
		owner := result["owner"].(map[string]interface{})
		assert.Equal(t, "Template", owner["firstName"])
		assert.Equal(t, "Owner", owner["lastName"])
	})

	t.Run("GET /api/templates - List templates", func(t *testing.T) {
		resp, err := http.Get(server.URL + "/api/templates")
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var result []map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)

		assert.GreaterOrEqual(t, len(result), 1)
	})

	t.Run("PUT /api/templates/:id - Update template", func(t *testing.T) {
		reqBody := map[string]interface{}{
			"name": "Updated E2E Template",
			"fields": []map[string]interface{}{
				{"label": "Problem", "order": 1, "isRequired": true},
				{"label": "Solution", "order": 2, "isRequired": true},
			},
		}
		body, _ := json.Marshal(reqBody)

		req, err := http.NewRequest(
			http.MethodPut,
			server.URL+"/api/templates/"+createdTemplateID+"?ownerId="+account.ID,
			bytes.NewReader(body),
		)
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var result map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)

		assert.Equal(t, "Updated E2E Template", result["name"])
		fields := result["fields"].([]interface{})
		assert.Len(t, fields, 2)
	})

	t.Run("DELETE /api/templates/:id - Delete template", func(t *testing.T) {
		// Create a new template to delete
		reqBody := map[string]interface{}{
			"name":    "Template to Delete",
			"ownerId": account.ID,
			"fields": []map[string]interface{}{
				{"label": "Field1", "order": 1, "isRequired": false},
			},
		}
		body, _ := json.Marshal(reqBody)

		createResp, err := http.Post(
			server.URL+"/api/templates",
			"application/json",
			bytes.NewReader(body),
		)
		require.NoError(t, err)

		var created map[string]interface{}
		err = json.NewDecoder(createResp.Body).Decode(&created)
		createResp.Body.Close()
		require.NoError(t, err)
		templateToDelete := created["id"].(string)

		// Delete it
		req, err := http.NewRequest(
			http.MethodDelete,
			server.URL+"/api/templates/"+templateToDelete+"?ownerId="+account.ID,
			nil,
		)
		require.NoError(t, err)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		// Verify deletion
		getResp, err := http.Get(server.URL + "/api/templates/" + templateToDelete)
		require.NoError(t, err)
		defer getResp.Body.Close()

		assert.Equal(t, http.StatusNotFound, getResp.StatusCode)
	})
}

func TestTemplateAPI_Errors(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping e2e test")
	}

	pg := basetestutil.SetupPostgres(t)
	server := testutil.StartTestServer(t, pg.ConnectionString)
	data := basetestutil.CreateDefaultTestData(t, server.Pool())

	t.Run("GET /api/templates/:id - Not found", func(t *testing.T) {
		resp, err := http.Get(server.URL + "/api/templates/00000000-0000-0000-0000-000000000000")
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("POST /api/templates - Invalid body", func(t *testing.T) {
		resp, err := http.Post(
			server.URL+"/api/templates",
			"application/json",
			bytes.NewReader([]byte("invalid-json")),
		)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("PUT /api/templates/:id - Missing ownerId", func(t *testing.T) {
		reqBody := map[string]interface{}{
			"name":   "Test",
			"fields": []map[string]interface{}{},
		}
		body, _ := json.Marshal(reqBody)

		req, err := http.NewRequest(
			http.MethodPut,
			server.URL+"/api/templates/"+data.Template.ID, // No ownerId query param
			bytes.NewReader(body),
		)
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		// API returns 400 Bad Request when ownerId is missing (required param)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("DELETE /api/templates/:id - Wrong owner", func(t *testing.T) {
		// Create another account
		otherAccount := basetestutil.CreateTestAccount(t, server.Pool(), basetestutil.TestAccount{
			Email: "other-template@example.com",
		})

		req, err := http.NewRequest(
			http.MethodDelete,
			server.URL+"/api/templates/"+data.Template.ID+"?ownerId="+otherAccount.ID,
			nil,
		)
		require.NoError(t, err)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}

func TestTemplateAPI_Filters(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping e2e test")
	}

	pg := basetestutil.SetupPostgres(t)
	server := testutil.StartTestServer(t, pg.ConnectionString)

	// Create accounts
	account1 := basetestutil.CreateTestAccount(t, server.Pool(), basetestutil.TestAccount{Email: "filter1@example.com"})
	account2 := basetestutil.CreateTestAccount(t, server.Pool(), basetestutil.TestAccount{Email: "filter2@example.com"})

	// Create templates for different owners
	basetestutil.CreateTestTemplate(t, server.Pool(), basetestutil.TestTemplate{
		Name:    "Design Document",
		OwnerID: account1.ID,
	})
	basetestutil.CreateTestTemplate(t, server.Pool(), basetestutil.TestTemplate{
		Name:    "Meeting Notes",
		OwnerID: account1.ID,
	})
	basetestutil.CreateTestTemplate(t, server.Pool(), basetestutil.TestTemplate{
		Name:    "Project Plan",
		OwnerID: account2.ID,
	})

	t.Run("GET /api/templates?ownerId=:id", func(t *testing.T) {
		resp, err := http.Get(server.URL + "/api/templates?ownerId=" + account1.ID)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var result []map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)

		assert.GreaterOrEqual(t, len(result), 2)
		for _, tpl := range result {
			assert.Equal(t, account1.ID, tpl["ownerId"])
		}
	})

	t.Run("GET /api/templates?q=Design", func(t *testing.T) {
		resp, err := http.Get(server.URL + "/api/templates?q=Design")
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var result []map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)

		assert.GreaterOrEqual(t, len(result), 1)
	})
}

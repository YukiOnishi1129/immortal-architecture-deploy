//go:build e2e

// Package e2e contains end-to-end API tests.
package e2e

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"immortal-architecture-clean/backend/tests/e2e/testutil"
	basetestutil "immortal-architecture-clean/backend/tests/testutil"
)

func TestNoteAPI_CRUD(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping e2e test")
	}

	// Setup PostgreSQL and test server
	pg := basetestutil.SetupPostgres(t)
	server := testutil.StartTestServer(t, pg.ConnectionString)

	// Create test data
	data := basetestutil.CreateDefaultTestData(t, server.Pool())

	var createdNoteID string

	t.Run("POST /api/notes - Create note", func(t *testing.T) {
		reqBody := map[string]interface{}{
			"title":      "E2E Test Note",
			"templateId": data.Template.ID,
			"ownerId":    data.Account.ID,
			"sections": []map[string]interface{}{
				{"fieldId": data.Template.Fields[0].ID, "content": "Background content"},
				{"fieldId": data.Template.Fields[1].ID, "content": "Solution content"},
				{"fieldId": data.Template.Fields[2].ID, "content": "Notes content"},
			},
		}
		body, _ := json.Marshal(reqBody)

		resp, err := http.Post(
			server.URL+"/api/notes",
			"application/json",
			bytes.NewReader(body),
		)
		require.NoError(t, err)
		defer resp.Body.Close()

		// Read body for debugging if status is not OK
		var result map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)

		if resp.StatusCode != http.StatusOK {
			t.Logf("Response body: %+v", result)
		}
		require.Equal(t, http.StatusOK, resp.StatusCode)

		createdNoteID = result["id"].(string)
		assert.NotEmpty(t, createdNoteID)
		assert.Equal(t, "E2E Test Note", result["title"])
		assert.Equal(t, "Draft", result["status"])
	})

	t.Run("GET /api/notes/:id - Get note", func(t *testing.T) {
		resp, err := http.Get(server.URL + "/api/notes/" + createdNoteID)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var result map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)

		assert.Equal(t, createdNoteID, result["id"])
		assert.Equal(t, "E2E Test Note", result["title"])
		assert.Equal(t, data.Template.Name, result["templateName"])
	})

	t.Run("GET /api/notes - List notes", func(t *testing.T) {
		resp, err := http.Get(server.URL + "/api/notes")
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var result []map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)

		assert.GreaterOrEqual(t, len(result), 1)
	})

	t.Run("PUT /api/notes/:id - Update note", func(t *testing.T) {
		// First, get the note to retrieve section IDs
		getResp, err := http.Get(server.URL + "/api/notes/" + createdNoteID)
		require.NoError(t, err)
		var noteData map[string]interface{}
		err = json.NewDecoder(getResp.Body).Decode(&noteData)
		getResp.Body.Close()
		require.NoError(t, err)

		sections := noteData["sections"].([]interface{})
		updatedSections := make([]map[string]interface{}, len(sections))
		for i, s := range sections {
			section := s.(map[string]interface{})
			updatedSections[i] = map[string]interface{}{
				"id":      section["id"],
				"content": fmt.Sprintf("Updated content %d", i+1),
			}
		}

		reqBody := map[string]interface{}{
			"title":    "Updated E2E Note",
			"sections": updatedSections,
		}
		body, _ := json.Marshal(reqBody)

		req, err := http.NewRequest(
			http.MethodPut,
			server.URL+"/api/notes/"+createdNoteID+"?ownerId="+data.Account.ID,
			bytes.NewReader(body),
		)
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		var result map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)

		if resp.StatusCode != http.StatusOK {
			t.Logf("Response body: %+v", result)
		}
		require.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Equal(t, "Updated E2E Note", result["title"])
	})

	t.Run("POST /api/notes/:id/publish - Publish note", func(t *testing.T) {
		req, err := http.NewRequest(
			http.MethodPost,
			server.URL+"/api/notes/"+createdNoteID+"/publish?ownerId="+data.Account.ID,
			nil,
		)
		require.NoError(t, err)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var result map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)
		assert.Equal(t, "Publish", result["status"])
	})

	t.Run("POST /api/notes/:id/unpublish - Unpublish note", func(t *testing.T) {
		req, err := http.NewRequest(
			http.MethodPost,
			server.URL+"/api/notes/"+createdNoteID+"/unpublish?ownerId="+data.Account.ID,
			nil,
		)
		require.NoError(t, err)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var result map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)
		assert.Equal(t, "Draft", result["status"])
	})

	t.Run("DELETE /api/notes/:id - Delete note", func(t *testing.T) {
		req, err := http.NewRequest(
			http.MethodDelete,
			server.URL+"/api/notes/"+createdNoteID+"?ownerId="+data.Account.ID,
			nil,
		)
		require.NoError(t, err)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		// Verify deletion
		getResp, err := http.Get(server.URL + "/api/notes/" + createdNoteID)
		require.NoError(t, err)
		defer getResp.Body.Close()

		assert.Equal(t, http.StatusNotFound, getResp.StatusCode)
	})
}

func TestNoteAPI_Errors(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping e2e test")
	}

	pg := basetestutil.SetupPostgres(t)
	server := testutil.StartTestServer(t, pg.ConnectionString)
	data := basetestutil.CreateDefaultTestData(t, server.Pool())

	t.Run("GET /api/notes/:id - Not found", func(t *testing.T) {
		resp, err := http.Get(server.URL + "/api/notes/00000000-0000-0000-0000-000000000000")
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("POST /api/notes - Invalid body", func(t *testing.T) {
		resp, err := http.Post(
			server.URL+"/api/notes",
			"application/json",
			bytes.NewReader([]byte("invalid-json")),
		)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("PUT /api/notes/:id - Missing ownerId", func(t *testing.T) {
		reqBody := map[string]interface{}{
			"title":    "Test",
			"sections": []map[string]interface{}{},
		}
		body, _ := json.Marshal(reqBody)

		req, err := http.NewRequest(
			http.MethodPut,
			server.URL+"/api/notes/"+data.Note.ID, // No ownerId query param
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

	t.Run("DELETE /api/notes/:id - Wrong owner", func(t *testing.T) {
		// Create another account
		otherAccount := basetestutil.CreateTestAccount(t, server.Pool(), basetestutil.TestAccount{
			Email: "other@example.com",
		})

		req, err := http.NewRequest(
			http.MethodDelete,
			server.URL+"/api/notes/"+data.Note.ID+"?ownerId="+otherAccount.ID,
			nil,
		)
		require.NoError(t, err)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}

func TestNoteAPI_Filters(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping e2e test")
	}

	pg := basetestutil.SetupPostgres(t)
	server := testutil.StartTestServer(t, pg.ConnectionString)
	data := basetestutil.CreateDefaultTestData(t, server.Pool())

	// Create additional notes
	basetestutil.CreateTestNote(t, server.Pool(), basetestutil.TestNote{
		Title:      "Published Note",
		TemplateID: data.Template.ID,
		OwnerID:    data.Account.ID,
		Status:     "Publish",
	})

	t.Run("GET /api/notes?status=Draft", func(t *testing.T) {
		resp, err := http.Get(server.URL + "/api/notes?status=Draft")
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var result []map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)

		for _, note := range result {
			assert.Equal(t, "Draft", note["status"])
		}
	})

	t.Run("GET /api/notes?status=Publish", func(t *testing.T) {
		resp, err := http.Get(server.URL + "/api/notes?status=Publish")
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var result []map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)

		assert.GreaterOrEqual(t, len(result), 1)
		for _, note := range result {
			assert.Equal(t, "Publish", note["status"])
		}
	})

	t.Run("GET /api/notes?ownerId=:id", func(t *testing.T) {
		resp, err := http.Get(server.URL + "/api/notes?ownerId=" + data.Account.ID)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var result []map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)

		assert.GreaterOrEqual(t, len(result), 2)
	})

	t.Run("GET /api/notes?q=Published", func(t *testing.T) {
		resp, err := http.Get(fmt.Sprintf("%s/api/notes?q=%s", server.URL, "Published"))
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var result []map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)

		assert.GreaterOrEqual(t, len(result), 1)
	})
}

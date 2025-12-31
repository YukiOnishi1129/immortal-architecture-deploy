// Package http provides factory functions for HTTP adapters.
package http

import httppresenter "immortal-architecture-clean/backend/internal/adapter/http/presenter"

// NewAccountOutputFactory returns a factory for HTTP AccountPresenter.
func NewAccountOutputFactory() func() *httppresenter.AccountPresenter {
	return func() *httppresenter.AccountPresenter {
		return httppresenter.NewAccountPresenter()
	}
}

// NewTemplateOutputFactory returns a factory for HTTP TemplatePresenter.
func NewTemplateOutputFactory() func() *httppresenter.TemplatePresenter {
	return func() *httppresenter.TemplatePresenter {
		return httppresenter.NewTemplatePresenter()
	}
}

// NewNoteOutputFactory returns a factory for HTTP NotePresenter.
func NewNoteOutputFactory() func() *httppresenter.NotePresenter {
	return func() *httppresenter.NotePresenter {
		return httppresenter.NewNotePresenter()
	}
}
